#!/usr/bin/env python3
"""Content Studio MCP server.

Gives any MCP-capable AI model a content-creation toolchain:

1. `content_studio_create_model` — take a picture as inspiration and distill
   it into a reusable **content model** (visual DNA, mood, voice, generation
   recipes) using a vision model behind an OmniRoute / OpenAI-compatible
   gateway.
2. `content_studio_generate_content` — create on-brand content (image prompts,
   captions, social posts, ad copy, blog outlines, video scripts) from a saved
   content model.
3. `content_studio_list_models` / `content_studio_get_model` /
   `content_studio_refine_model` / `content_studio_delete_model` — manage the
   local library of content models.

Configuration (environment variables):
    OMNIROUTE_BASE_URL           OpenAI-compatible base URL (default: http://localhost:8080/v1;
                                 falls back to OPENAI_BASE_URL)
    OMNIROUTE_API_KEY            API key for the gateway (falls back to OPENAI_API_KEY)
    CONTENT_STUDIO_VISION_MODEL  Model id routed for image analysis (default: openai/gpt-4o)
    CONTENT_STUDIO_TEXT_MODEL    Model id routed for content generation (default: vision model)
    CONTENT_STUDIO_HOME          Where content models are stored (default: ~/.content-studio)
"""

import base64
import hashlib
import json
import mimetypes
import os
import re
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel, ConfigDict, Field, field_validator

try:  # MCP SDK 2.x
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # MCP SDK 1.x
    from mcp.server.fastmcp import FastMCP as _Server
from mcp.types import ToolAnnotations

mcp = _Server("content_studio_mcp")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OMNIROUTE_BASE_URL = (
    os.environ.get("OMNIROUTE_BASE_URL")
    or os.environ.get("OPENAI_BASE_URL")
    or "http://localhost:8080/v1"
).rstrip("/")
OMNIROUTE_API_KEY = os.environ.get("OMNIROUTE_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
VISION_MODEL = os.environ.get("CONTENT_STUDIO_VISION_MODEL", "openai/gpt-4o")
TEXT_MODEL = os.environ.get("CONTENT_STUDIO_TEXT_MODEL", VISION_MODEL)
STUDIO_HOME = Path(os.environ.get("CONTENT_STUDIO_HOME", "~/.content-studio")).expanduser()
MODELS_DIR = STUDIO_HOME / "models"

REQUEST_TIMEOUT = 120.0
MAX_IMAGE_BYTES = 20 * 1024 * 1024  # refuse to inline images larger than 20 MB

# The structured profile the vision model is asked to fill in. This is the
# "content model": everything downstream generation needs to stay on-brand.
CONTENT_MODEL_SPEC = """{
  "summary": "2-3 sentence description of the image and the creative direction it implies",
  "visual_dna": {
    "palette": [{"hex": "#RRGGBB", "name": "human color name", "role": "dominant|secondary|accent"}],
    "lighting": "lighting character (source, direction, quality, temperature)",
    "composition": "framing, perspective, negative space, focal hierarchy",
    "textures_materials": ["notable textures and materials"],
    "subjects": ["main subjects / motifs"],
    "style": "artistic style / movement / medium (e.g. 35mm editorial photo, flat vector, oil painting)",
    "era_or_context": "time period or cultural context the aesthetic evokes"
  },
  "mood": {
    "keywords": ["3-6 mood keywords"],
    "emotional_tone": "the feeling the image projects",
    "energy": "calm|balanced|energetic"
  },
  "voice": {
    "tone": "written voice that matches the aesthetic (e.g. warm and unhurried, punchy and irreverent)",
    "vocabulary": ["words and phrase families that fit"],
    "avoid": ["words, cliches or vibes that would break the aesthetic"]
  },
  "audience": "who this aesthetic most plausibly speaks to",
  "generation": {
    "image_prompt_template": "reusable text-to-image prompt capturing subject-agnostic style: lighting, palette, composition, medium, lens/render details. Use {subject} as the placeholder.",
    "negative_prompt": "elements to exclude when generating images in this style",
    "hashtags": ["8-12 relevant hashtags without the # sign"],
    "content_dos": ["3-5 rules content in this style should follow"],
    "content_donts": ["3-5 things to avoid"]
  }
}"""

CONTENT_TYPE_BRIEFS: Dict[str, str] = {
    "image_prompt": (
        "Write ready-to-use text-to-image prompts (for Midjourney/Flux/Stable Diffusion class models). "
        "Start from the model's image_prompt_template, resolve {subject} with the brief, keep palette, "
        "lighting, composition and medium faithful to the visual DNA, and append the negative prompt on "
        "its own line prefixed with 'Negative:'."
    ),
    "caption": (
        "Write short social captions (1-2 sentences plus a tasteful emoji where fitting) in the model's "
        "voice, each followed by a line of 5-8 hashtags drawn from the model's hashtag list."
    ),
    "social_post": (
        "Write full social posts (hook, body, call to action) in the model's voice. Respect the "
        "content_dos/content_donts and end with relevant hashtags."
    ),
    "ad_copy": (
        "Write ad copy variants: a headline (max 40 chars), primary text (max 125 words), and a CTA, "
        "all consistent with the model's voice and audience."
    ),
    "blog_outline": (
        "Write a blog post outline: working title, hook, H2/H3 section structure with one-line notes per "
        "section, and a closing CTA — all angled for the model's audience and tone."
    ),
    "video_script": (
        "Write a short-form video script (30-60s): scene-by-scene visual directions that mirror the "
        "visual DNA (palette, lighting, composition) plus voiceover lines in the model's voice."
    ),
}

# ---------------------------------------------------------------------------
# Gateway client
# ---------------------------------------------------------------------------


async def _chat_completion(model: str, messages: List[Dict[str, Any]], max_tokens: int = 4096) -> str:
    """Call the OmniRoute (OpenAI-compatible) /chat/completions endpoint and return the text."""
    headers = {"Content-Type": "application/json"}
    if OMNIROUTE_API_KEY:
        headers["Authorization"] = f"Bearer {OMNIROUTE_API_KEY}"
    payload = {"model": model, "messages": messages, "max_tokens": max_tokens}
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(f"{OMNIROUTE_BASE_URL}/chat/completions", json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError(f"Gateway returned an unexpected response shape: {json.dumps(data)[:500]}") from exc
    if isinstance(content, list):  # some gateways return content blocks
        content = "".join(block.get("text", "") for block in content if isinstance(block, dict))
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Gateway returned an empty completion.")
    return content


def _handle_error(e: Exception) -> str:
    """Consistent, actionable error strings for every tool."""
    if isinstance(e, httpx.ConnectError):
        return (
            f"Error: could not reach the model gateway at {OMNIROUTE_BASE_URL}. "
            "Is OmniRoute running? Set OMNIROUTE_BASE_URL to the correct OpenAI-compatible endpoint."
        )
    if isinstance(e, httpx.HTTPStatusError):
        code = e.response.status_code
        if code == 401:
            return "Error: gateway rejected the API key (401). Set OMNIROUTE_API_KEY."
        if code == 404:
            return (
                f"Error: gateway returned 404 for {OMNIROUTE_BASE_URL}/chat/completions. "
                "Check that OMNIROUTE_BASE_URL includes the /v1 suffix."
            )
        if code == 429:
            return "Error: gateway rate limit exceeded (429). Retry shortly."
        detail = e.response.text[:300]
        return f"Error: gateway request failed with status {code}: {detail}"
    if isinstance(e, httpx.TimeoutException):
        return "Error: gateway request timed out. Try again or point CONTENT_STUDIO_VISION_MODEL at a faster route."
    if isinstance(e, (ValueError, FileNotFoundError)):
        return f"Error: {e}"
    return f"Error: unexpected {type(e).__name__}: {e}"


# ---------------------------------------------------------------------------
# Image + JSON helpers
# ---------------------------------------------------------------------------


def _image_content_part(image_source: str) -> Dict[str, Any]:
    """Turn a local file path or an http(s) URL into an OpenAI image_url content part."""
    if re.match(r"^https?://", image_source, re.IGNORECASE):
        return {"type": "image_url", "image_url": {"url": image_source}}
    path = Path(image_source).expanduser()
    if not path.is_file():
        raise FileNotFoundError(f"image not found at '{image_source}' (pass a local file path or an http(s) URL)")
    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError(f"image is larger than {MAX_IMAGE_BYTES // (1024 * 1024)} MB; resize it first")
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    if not mime.startswith("image/"):
        raise ValueError(f"'{path.name}' does not look like an image (detected {mime})")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}}


def _extract_json(text: str) -> Dict[str, Any]:
    """Parse a JSON object out of a model reply, tolerating code fences and prose."""
    stripped = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        start, end = stripped.find("{"), stripped.rfind("}")
        if start == -1 or end <= start:
            raise ValueError(f"model reply contained no JSON object: {text[:300]}")
        return json.loads(stripped[start : end + 1])


# ---------------------------------------------------------------------------
# Content-model storage
# ---------------------------------------------------------------------------


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "content-model"


def _model_path(model_id: str) -> Path:
    return MODELS_DIR / f"{model_id}.json"


def _save_model(record: Dict[str, Any]) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    _model_path(record["id"]).write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")


def _load_model(model_id: str) -> Dict[str, Any]:
    path = _model_path(model_id)
    if not path.is_file():
        available = ", ".join(sorted(p.stem for p in MODELS_DIR.glob("*.json"))) or "none saved yet"
        raise ValueError(f"no content model with id '{model_id}'. Available: {available}")
    return json.loads(path.read_text(encoding="utf-8"))


def _new_model_id(name: str) -> str:
    base = _slugify(name)
    if not _model_path(base).exists():
        return base
    suffix = hashlib.sha1(f"{name}{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()[:6]
    return f"{base}-{suffix}"


def _model_summary_md(record: Dict[str, Any]) -> str:
    profile = record.get("profile", {})
    dna = profile.get("visual_dna", {})
    mood = profile.get("mood", {})
    palette = ", ".join(f"{c.get('hex', '?')} ({c.get('name', '?')})" for c in dna.get("palette", [])[:5])
    lines = [
        f"# Content model: {record['name']} (`{record['id']}`)",
        "",
        profile.get("summary", ""),
        "",
        f"- **Style**: {dna.get('style', '—')}",
        f"- **Palette**: {palette or '—'}",
        f"- **Lighting**: {dna.get('lighting', '—')}",
        f"- **Mood**: {', '.join(mood.get('keywords', [])) or '—'}",
        f"- **Voice**: {profile.get('voice', {}).get('tone', '—')}",
        f"- **Audience**: {profile.get('audience', '—')}",
        f"- **Source image**: {record.get('source_image', '—')}",
        f"- **Created**: {record.get('created_at', '—')} · version {record.get('version', 1)}",
        "",
        f"Use `content_studio_generate_content` with model_id `{record['id']}` to create content in this style.",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------


class ResponseFormat(str, Enum):
    MARKDOWN = "markdown"
    JSON = "json"


class ContentType(str, Enum):
    IMAGE_PROMPT = "image_prompt"
    CAPTION = "caption"
    SOCIAL_POST = "social_post"
    AD_COPY = "ad_copy"
    BLOG_OUTLINE = "blog_outline"
    VIDEO_SCRIPT = "video_script"


class CreateModelInput(BaseModel):
    """Input for creating a content model from an inspiration image."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    image_source: str = Field(
        ...,
        description="Inspiration image: a local file path (e.g. '/photos/moodboard.jpg') or an http(s) URL",
        min_length=1,
    )
    name: Optional[str] = Field(
        default=None,
        description="Human name for the content model (e.g. 'Desert Minimalism'); derived from the image if omitted",
        max_length=80,
    )
    focus: Optional[str] = Field(
        default=None,
        description="Optional steer for the analysis (e.g. 'we sell handmade ceramics', 'target Gen-Z gamers')",
        max_length=500,
    )


class ModelIdInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    model_id: str = Field(..., description="Content model id as returned by create/list (e.g. 'desert-minimalism')", min_length=1)


class GetModelInput(ModelIdInput):
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="'markdown' for a readable summary, 'json' for the full stored profile",
    )


class RefineModelInput(ModelIdInput):
    instructions: str = Field(
        ...,
        description="How to adjust the model (e.g. 'shift the palette warmer and make the voice more playful')",
        min_length=3,
        max_length=2000,
    )


class GenerateContentInput(ModelIdInput):
    content_type: ContentType = Field(
        ...,
        description="What to create: image_prompt | caption | social_post | ad_copy | blog_outline | video_script",
    )
    brief: str = Field(
        ...,
        description="Subject or campaign brief (e.g. 'spring launch of our linen collection')",
        min_length=3,
        max_length=2000,
    )
    count: int = Field(default=3, description="Number of variants to produce", ge=1, le=10)
    platform: Optional[str] = Field(
        default=None,
        description="Optional target platform to tailor format/length (e.g. 'instagram', 'linkedin', 'tiktok')",
        max_length=40,
    )

    @field_validator("brief")
    @classmethod
    def brief_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("brief cannot be blank")
        return v


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@mcp.tool(
    name="content_studio_create_model",
    annotations=ToolAnnotations(
        title="Create Content Model from Image",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=True,
    ),
)
async def content_studio_create_model(params: CreateModelInput) -> str:
    """Analyze an inspiration picture and create a reusable content model from it.

    Sends the image to a vision model through the OmniRoute gateway and distills
    it into a structured profile — visual DNA (palette, lighting, composition,
    style), mood, written voice, audience, and generation recipes (image prompt
    template, negative prompt, hashtags, do/don't rules). The profile is saved
    locally so it can power any number of later generations.

    Args:
        params (CreateModelInput):
            - image_source (str): local file path or http(s) URL of the image
            - name (Optional[str]): display name; derived from the image if omitted
            - focus (Optional[str]): brand/audience context to steer the analysis

    Returns:
        str: Markdown summary of the new model including its `model_id`, or an
        "Error: ..." string (gateway unreachable, bad image path, invalid key).

    Examples:
        - "Make a content model out of ~/inspo/cafe.jpg for my coffee brand"
          -> image_source="~/inspo/cafe.jpg", focus="specialty coffee brand"
        - Don't use when: you already have a model and just want content
          (use content_studio_generate_content instead).
    """
    try:
        image_part = _image_content_part(params.image_source)
        focus_line = f"\nBrand/audience context to factor in: {params.focus}" if params.focus else ""
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a creative director who reverse-engineers aesthetics. "
                    "Given an inspiration image, produce a machine-usable style profile. "
                    "Reply with ONLY a JSON object exactly matching this schema (no prose, no code fences):\n"
                    + CONTENT_MODEL_SPEC
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze this inspiration image and fill in the content-model JSON." + focus_line,
                    },
                    image_part,
                ],
            },
        ]
        profile = _extract_json(await _chat_completion(VISION_MODEL, messages))

        name = params.name or profile.get("summary", "Content Model").split(".")[0][:60] or "Content Model"
        record = {
            "id": _new_model_id(name),
            "name": name,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "version": 1,
            "source_image": params.image_source,
            "focus": params.focus,
            "vision_model": VISION_MODEL,
            "profile": profile,
        }
        _save_model(record)
        return _model_summary_md(record)
    except Exception as e:  # noqa: BLE001 — every failure becomes an actionable string
        return _handle_error(e)


@mcp.tool(
    name="content_studio_list_models",
    annotations=ToolAnnotations(
        title="List Content Models",
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    ),
)
async def content_studio_list_models() -> str:
    """List every saved content model in the local library.

    Returns:
        str: Markdown table of models (id, name, style, created, version), or a
        note that the library is empty.
    """
    records = []
    for path in sorted(MODELS_DIR.glob("*.json")):
        try:
            records.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    if not records:
        return "No content models saved yet. Create one with content_studio_create_model."
    lines = ["| id | name | style | created | version |", "|---|---|---|---|---|"]
    for r in records:
        style = r.get("profile", {}).get("visual_dna", {}).get("style", "—")
        lines.append(f"| `{r['id']}` | {r.get('name', '—')} | {style} | {r.get('created_at', '—')} | {r.get('version', 1)} |")
    return "\n".join(lines)


@mcp.tool(
    name="content_studio_get_model",
    annotations=ToolAnnotations(
        title="Get Content Model",
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    ),
)
async def content_studio_get_model(params: GetModelInput) -> str:
    """Fetch one saved content model, as a readable summary or full JSON.

    Args:
        params (GetModelInput):
            - model_id (str): id from create/list
            - response_format ('markdown'|'json'): summary vs. the complete stored profile

    Returns:
        str: Markdown summary or pretty-printed JSON of the model record, or an
        "Error: ..." string listing available ids when the id is unknown.
    """
    try:
        record = _load_model(params.model_id)
        if params.response_format == ResponseFormat.JSON:
            return json.dumps(record, indent=2, ensure_ascii=False)
        return _model_summary_md(record)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


@mcp.tool(
    name="content_studio_refine_model",
    annotations=ToolAnnotations(
        title="Refine Content Model",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=True,
    ),
)
async def content_studio_refine_model(params: RefineModelInput) -> str:
    """Adjust an existing content model with natural-language instructions.

    Sends the stored profile plus your instructions to the text model and saves
    the edited profile back as a new version of the same model id.

    Args:
        params (RefineModelInput):
            - model_id (str): id of the model to refine
            - instructions (str): e.g. "warmer palette, drop the hashtags about travel"

    Returns:
        str: Markdown summary of the updated model, or an "Error: ..." string.
    """
    try:
        record = _load_model(params.model_id)
        messages = [
            {
                "role": "system",
                "content": (
                    "You edit content-model JSON profiles. Apply the requested changes and reply with ONLY "
                    "the complete updated JSON object in the same schema — no prose, no code fences."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Current profile:\n{json.dumps(record['profile'], indent=2, ensure_ascii=False)}\n\n"
                    f"Requested changes: {params.instructions}"
                ),
            },
        ]
        record["profile"] = _extract_json(await _chat_completion(TEXT_MODEL, messages))
        record["version"] = int(record.get("version", 1)) + 1
        record["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        _save_model(record)
        return _model_summary_md(record)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


@mcp.tool(
    name="content_studio_generate_content",
    annotations=ToolAnnotations(
        title="Generate Content from Model",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=True,
    ),
)
async def content_studio_generate_content(params: GenerateContentInput) -> str:
    """Create content in the style of a saved content model.

    Loads the model's profile and asks the text model (via the gateway) to
    produce `count` variants of the requested content type, staying faithful to
    the model's visual DNA, mood, voice, and do/don't rules.

    Args:
        params (GenerateContentInput):
            - model_id (str): which content model to use
            - content_type: image_prompt | caption | social_post | ad_copy | blog_outline | video_script
            - brief (str): subject/campaign to create content about
            - count (int): number of variants, 1-10 (default 3)
            - platform (Optional[str]): tailor to a platform, e.g. 'instagram'

    Returns:
        str: Markdown with the generated variants, or an "Error: ..." string.

    Examples:
        - "3 image prompts for our summer drop in the desert-minimalism style"
          -> model_id="desert-minimalism", content_type="image_prompt",
             brief="summer collection drop", count=3
    """
    try:
        record = _load_model(params.model_id)
        platform_line = f"\nTarget platform: {params.platform} — follow its format norms." if params.platform else ""
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a content creator working inside a locked brand style. This content model is the "
                    "single source of truth — obey its palette, mood, voice, audience and do/don't rules:\n"
                    + json.dumps(record["profile"], indent=2, ensure_ascii=False)
                ),
            },
            {
                "role": "user",
                "content": (
                    f"{CONTENT_TYPE_BRIEFS[params.content_type.value]}\n\n"
                    f"Brief: {params.brief}{platform_line}\n"
                    f"Produce exactly {params.count} distinct variants as a numbered Markdown list."
                ),
            },
        ]
        output = await _chat_completion(TEXT_MODEL, messages)
        header = (
            f"# {params.content_type.value.replace('_', ' ').title()} — {record['name']}\n"
            f"_Brief: {params.brief}_\n"
        )
        return f"{header}\n{output.strip()}"
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


@mcp.tool(
    name="content_studio_delete_model",
    annotations=ToolAnnotations(
        title="Delete Content Model",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=True,
        openWorldHint=False,
    ),
)
async def content_studio_delete_model(params: ModelIdInput) -> str:
    """Permanently delete a saved content model from the local library.

    Args:
        params (ModelIdInput):
            - model_id (str): id of the model to delete

    Returns:
        str: Confirmation, or an "Error: ..." string listing available ids.
    """
    try:
        record = _load_model(params.model_id)  # validates existence, surfaces available ids
        _model_path(params.model_id).unlink()
        return f"Deleted content model '{record.get('name', params.model_id)}' (`{params.model_id}`)."
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


if __name__ == "__main__":
    mcp.run()
