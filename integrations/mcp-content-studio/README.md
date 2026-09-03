# 🎨 Content Studio MCP Integration

> Give any AI model a content-creation toolchain: hand it a picture as
> inspiration, and it distills a reusable **content model** — then creates
> on-brand content from that model on demand.

## What It Does

`server.py` is an MCP (Model Context Protocol) server that plugs into any
MCP-capable client (Claude Code, Claude Desktop, Cursor, …) and routes its
LLM calls through an **OmniRoute / OpenAI-compatible gateway**, so you decide
which vision and text models actually do the work.

The workflow it enables:

1. **Picture in** — `content_studio_create_model` sends your inspiration image
   to a vision model and reverse-engineers it into a structured *content
   model*: palette, lighting, composition, style, mood, written voice,
   audience, a reusable image-prompt template, negative prompt, hashtags, and
   do/don't rules.
2. **Model saved** — profiles are stored as JSON under `~/.content-studio/models/`
   and versioned as you refine them.
3. **Content out** — `content_studio_generate_content` creates image prompts,
   captions, social posts, ad copy, blog outlines, or video scripts that stay
   faithful to the model.

## Tools

| Tool | What it does |
|---|---|
| `content_studio_create_model` | Analyze an inspiration image (file path or URL) into a saved content model |
| `content_studio_list_models` | List the local content-model library |
| `content_studio_get_model` | Fetch one model (markdown summary or full JSON) |
| `content_studio_refine_model` | Adjust a model with natural language ("warmer palette, punchier voice") |
| `content_studio_generate_content` | Generate N variants of a content type from a model + brief |
| `content_studio_delete_model` | Remove a model from the library |

## Setup

```bash
cd integrations/mcp-content-studio
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

### Configuration

The server talks to any OpenAI-compatible `/chat/completions` endpoint —
point it at your OmniRoute gateway (or OpenRouter, LiteLLM, vLLM, OpenAI
itself):

| Variable | Default | Purpose |
|---|---|---|
| `OMNIROUTE_BASE_URL` | `http://localhost:8080/v1` (falls back to `OPENAI_BASE_URL`) | Gateway base URL, including `/v1` |
| `OMNIROUTE_API_KEY` | falls back to `OPENAI_API_KEY` | Bearer token for the gateway |
| `CONTENT_STUDIO_VISION_MODEL` | `openai/gpt-4o` | Model id the gateway routes for image analysis |
| `CONTENT_STUDIO_TEXT_MODEL` | same as vision model | Model id for content generation |
| `CONTENT_STUDIO_HOME` | `~/.content-studio` | Where content models are stored |

### Register with your MCP client

Claude Code:

```bash
claude mcp add content-studio \
  --env OMNIROUTE_BASE_URL=http://localhost:8080/v1 \
  --env OMNIROUTE_API_KEY=sk-... \
  --env CONTENT_STUDIO_VISION_MODEL=openai/gpt-4o \
  -- /path/to/agency-agents/integrations/mcp-content-studio/.venv/bin/python \
     /path/to/agency-agents/integrations/mcp-content-studio/server.py
```

Or in any client's JSON config:

```json
{
  "mcpServers": {
    "content-studio": {
      "command": "/path/to/.venv/bin/python",
      "args": ["/path/to/agency-agents/integrations/mcp-content-studio/server.py"],
      "env": {
        "OMNIROUTE_BASE_URL": "http://localhost:8080/v1",
        "OMNIROUTE_API_KEY": "sk-...",
        "CONTENT_STUDIO_VISION_MODEL": "openai/gpt-4o"
      }
    }
  }
}
```

## Usage

Once registered, just talk to your model:

> "Take `~/inspo/moodboard.jpg` as inspiration and create a content model for
> my ceramics brand."

> "Using the `desert-minimalism` model, write 5 Instagram captions for our
> spring launch."

> "Refine `desert-minimalism`: shift the palette warmer and make the voice
> more playful."

Pairs well with the roster: [Image Prompt Engineer](../../design/design-image-prompt-engineer.md),
[Content Creator](../../marketing/marketing-content-creator.md), and
[Brand Guardian](../../design/design-brand-guardian.md). See
[content-alchemist-agent.md](content-alchemist-agent.md) for an agent prompt
wired to these tools.
