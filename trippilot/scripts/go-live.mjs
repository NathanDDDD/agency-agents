#!/usr/bin/env node
/**
 * TripPilot go-live: one guided command that takes a fresh clone to a live deployment.
 *
 *   npm run go-live
 *
 * Steps (each can be skipped, and the script is safe to re-run):
 *   1. Checks Node and installs dependencies.
 *   2. Asks for your Supabase and Anthropic keys and writes .env.local (secrets never leave your machine
 *      except to the service they belong to, and to Vercel if you deploy).
 *   3. Verifies both keys with free API calls.
 *   4. Applies the database migrations (Supabase CLI) and verifies the schema and quota functions exist.
 *   5. Runs lint, typecheck, unit tests and a production build.
 *   6. Starts the production server locally and checks live mode is on.
 *   7. Deploys to Vercel (CLI), sets environment variables, and sets the site URL.
 *   8. Optionally runs the live quality benchmark (costs money; asks first, default no).
 *
 * Works on macOS, Linux and Windows (Node 22+).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const isWin = process.platform === "win32";
const ENV_FILE = path.join(root, ".env.local");

// ── tiny UI helpers ────────────────────────────────────────────────────────
const c = (n) => (s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const bold = c(1), green = c(32), red = c(31), yellow = c(33), dim = c(2);
const ok = (m) => console.log(`${green("✓")} ${m}`);
const warn = (m) => console.log(`${yellow("!")} ${m}`);
const fail = (m) => console.log(`${red("✗")} ${m}`);
const step = (n, m) => console.log(`\n${bold(`── Step ${n}: ${m} `)}${dim("─".repeat(Math.max(0, 50 - m.length)))}`);

const tty = Boolean(process.stdin.isTTY);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
let muted = false;
// While a secret is being typed, echo nothing (the prompt itself is written before muting starts).
rl._writeToOutput = function (s) {
  if (!muted) rl.output.write(s);
};
// Line queue, so answers typed (or piped) ahead of a prompt are never lost.
const pending = [];
const waiters = [];
let closed = false;
rl.on("line", (l) => (waiters.length ? waiters.shift()(l) : pending.push(l)));
rl.on("close", () => {
  closed = true;
  while (waiters.length) waiters.shift()(null);
});
function ask(q, { def = "", secret = false } = {}) {
  const shown = def ? `${q} ${dim(secret ? "[keep current]" : `[${def}]`)} ` : `${q} `;
  process.stdout.write(shown);
  muted = secret && tty;
  return new Promise((resolve) => {
    const done = (a) => {
      muted = false;
      if (a === null) {
        console.log("\nInput closed. Stopping; re-run `npm run go-live` to continue.");
        process.exit(1);
      }
      if (secret || !tty) process.stdout.write("\n");
      resolve(a.trim() || def);
    };
    if (pending.length) done(pending.shift());
    else if (closed) done(null);
    else waiters.push(done);
  });
}
async function yes(q, def = true) {
  const a = (await ask(`${q} ${dim(def ? "(Y/n)" : "(y/N)")}`)).toLowerCase();
  return a ? a.startsWith("y") : def;
}

function run(cmd, args, opts = {}) {
  console.log(dim(`$ ${cmd} ${args.join(" ")}`));
  const r = spawnSync(cmd, args, { stdio: opts.capture ? ["inherit", "pipe", "inherit"] : "inherit", shell: isWin, encoding: "utf8", ...opts });
  return { ok: r.status === 0, out: r.stdout ?? "" };
}

// ── .env.local handling ────────────────────────────────────────────────────
function readEnv() {
  const src = existsSync(ENV_FILE) ? ENV_FILE : path.join(root, ".env.example");
  const lines = readFileSync(src, "utf8").split(/\r?\n/);
  const values = {};
  for (const l of lines) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) values[m[1]] = m[2];
  }
  return { lines, values };
}
function writeEnv(lines, values) {
  const seen = new Set();
  const out = lines.map((l) => {
    const m = l.match(/^([A-Z0-9_]+)=/);
    if (!m) return l;
    seen.add(m[1]);
    return `${m[1]}=${values[m[1]] ?? ""}`;
  });
  for (const [k, v] of Object.entries(values)) if (!seen.has(k)) out.push(`${k}=${v}`);
  writeFileSync(ENV_FILE, out.join("\n"), { mode: 0o600 });
}

// ── service checks (all free) ──────────────────────────────────────────────
async function checkSupabase(url, anon) {
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } });
    return r.ok ? null : `Supabase answered ${r.status}. Check the URL and the anon (public) key.`;
  } catch (e) {
    return `Could not reach ${url}: ${e.message}`;
  }
}
async function checkAnthropic(key) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
    if (r.ok) return null;
    return r.status === 401 ? "Anthropic rejected the key (401)." : `Anthropic answered ${r.status}.`;
  } catch (e) {
    return `Could not reach Anthropic: ${e.message}`;
  }
}
/** Returns a list of missing pieces of the schema ([] when everything is in place). */
async function checkSchema(url, anon) {
  const missing = [];
  const h = { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" };
  for (const table of ["profiles", "trips", "itinerary_days", "activities", "ai_usage"]) {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers: h });
    if (r.status === 404 || (await r.text()).includes("PGRST205")) missing.push(`table ${table}`);
  }
  // anon has no EXECUTE on the quota function: "permission denied" means it exists, PGRST202 means it doesn't.
  const r = await fetch(`${url}/rest/v1/rpc/consume_ai_quota`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ p_kind: "chat", p_units: 1, p_daily_limit: 1, p_burst_limit: 1, p_model: "check" }),
  });
  const body = await r.text();
  if (r.status === 404 || body.includes("PGRST202")) missing.push("function consume_ai_quota");
  return missing;
}

function waitForServer(url, ms) {
  const until = Date.now() + ms;
  return new Promise((resolve) => {
    const tick = async () => {
      try {
        const r = await fetch(url);
        if (r.ok) return resolve(await r.json());
      } catch {}
      if (Date.now() > until) return resolve(null);
      setTimeout(tick, 1000);
    };
    tick();
  });
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold("\nTripPilot go-live\n") + dim("Press Enter to accept the value in [brackets]. Ctrl+C to stop at any time; re-running is safe.\n"));

  step(1, "Node and dependencies");
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    fail(`Node ${process.versions.node} found; TripPilot needs Node 22 or newer (https://nodejs.org).`);
    process.exit(1);
  }
  ok(`Node ${process.versions.node}`);
  if (!existsSync(path.join(root, "node_modules")) || (await yes("Reinstall dependencies (npm ci)?", false))) {
    if (!run("npm", ["ci"]).ok) return fail("npm ci failed. Fix the error above and re-run.");
  }
  ok("Dependencies installed");

  step(2, "Keys (.env.local)");
  const { lines, values } = readEnv();
  console.log(dim("Supabase: dashboard → your project → Project Settings → API (Project URL and the anon public key)."));
  values.NEXT_PUBLIC_SUPABASE_URL = (await ask("Supabase Project URL:", { def: values.NEXT_PUBLIC_SUPABASE_URL })).replace(/\/+$/, "");
  values.NEXT_PUBLIC_SUPABASE_ANON_KEY = await ask("Supabase anon public key:", { def: values.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret: true });
  console.log(dim("Anthropic: console.anthropic.com → API keys."));
  values.ANTHROPIC_API_KEY = await ask("Anthropic API key:", { def: values.ANTHROPIC_API_KEY, secret: true });
  console.log(dim("Optional: your contact email for OpenStreetMap address lookups (their usage policy asks for one). Leave empty to skip."));
  values.GEOCODER_CONTACT_EMAIL = await ask("Contact email for map lookups:", { def: values.GEOCODER_CONTACT_EMAIL });
  values.NEXT_PUBLIC_SITE_URL ||= "http://localhost:3000";
  writeEnv(lines, values);
  ok(".env.local saved (git-ignored, readable only by you)");

  step(3, "Verify keys");
  const sbUrl = values.NEXT_PUBLIC_SUPABASE_URL, anon = values.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sbErr = sbUrl && anon ? await checkSupabase(sbUrl, anon) : "Supabase URL or key missing.";
  if (sbErr) fail(sbErr);
  else ok("Supabase project reachable");
  const aiErr = values.ANTHROPIC_API_KEY ? await checkAnthropic(values.ANTHROPIC_API_KEY) : "Anthropic key missing.";
  if (aiErr) fail(aiErr);
  else ok("Anthropic key valid");
  if (sbErr || aiErr) {
    if (!(await yes("Continue anyway? (live features won't work until fixed)", false))) process.exit(1);
  }

  step(4, "Database migrations");
  let missing = sbErr ? ["(Supabase unreachable)"] : await checkSchema(sbUrl, anon);
  if (!missing.length) ok("Schema and AI quota functions already in place");
  else {
    warn(`Missing: ${missing.join(", ")}`);
    const ref = sbUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
    console.log(dim("The Supabase CLI applies both migrations in order. It needs your database connection string:"));
    console.log(dim(`dashboard → Connect (top bar) → "Session pooler" URI${ref ? ` for project ${ref}` : ""}, with your database password filled in.`));
    console.log(dim("It is used once and not saved."));
    const dbUrl = await ask("Postgres connection string (Enter to skip and use the SQL Editor instead):", { secret: true });
    let applied = false;
    if (dbUrl) applied = run("npx", ["--yes", "supabase@latest", "db", "push", "--db-url", dbUrl, "--include-all"]).ok;
    if (!applied) {
      const files = readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
      warn("Apply the migrations by hand: Supabase dashboard → SQL Editor → New query, paste each file below in order, Run:");
      for (const f of files) console.log(`    supabase/migrations/${f}`);
      await ask("Press Enter when done…");
    }
    missing = await checkSchema(sbUrl, anon);
    if (missing.length) fail(`Still missing: ${missing.join(", ")}. Live AI stays blocked until the quota migration runs.`);
    else ok("Schema verified");
  }

  step(5, "Lint, typecheck, unit tests, build");
  const checks = [["lint"], ["run", "typecheck"], ["test"], ["run", "build"]];
  for (const a of checks) {
    if (!run("npm", a).ok) {
      fail(`npm ${a.join(" ")} failed.`);
      if (!(await yes("Continue anyway?", false))) process.exit(1);
    }
  }
  ok("All checks passed");

  step(6, "Local live check");
  const port = 3100;
  const server = spawn("npx", ["next", "start", "-p", String(port)], { stdio: "ignore", shell: isWin });
  const status = await waitForServer(`http://localhost:${port}/api/status`, 60_000);
  if (!status) fail("Server didn't start within 60 s.");
  else {
    if (status.supabase) ok("Supabase live");
    else fail("Supabase not configured in the running app");
    if (status.ai) ok("Claude live");
    else fail("Claude not configured in the running app");
  }
  if (status?.supabase && status?.ai) {
    console.log(`\n  Open ${bold(`http://localhost:${port}`)}, create an account, confirm the email, and plan a trip.`);
    console.log(dim("  In Supabase → Authentication → URL Configuration, add http://localhost:3100/** and http://localhost:3000/** to Redirect URLs first."));
    await ask("  Press Enter when you've tried it (or to move on)…");
  }
  if (isWin) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill();

  step(7, "Deploy to Vercel");
  if (await yes("Deploy to Vercel now? (free Hobby plan works; you'll log in in the browser)")) {
    const vercel = (args, opts) => run("npx", ["--yes", "vercel@latest", ...args], opts);
    if (!vercel(["whoami"]).ok && !vercel(["login"]).ok) return fail("Vercel login failed.");
    // Link this folder (trippilot/) as the project root.
    if (!existsSync(path.join(root, ".vercel/project.json")) && !vercel(["link"]).ok) return fail("vercel link failed.");
    const envKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY", "GEOCODER_CONTACT_EMAIL",
      "AI_DAILY_CREDIT_LIMIT", "AI_BURST_LIMIT", "NEXT_PUBLIC_MAP_PROVIDER", "ANTHROPIC_MODEL", "MAPBOX_TOKEN", "NEXT_PUBLIC_MAPBOX_TOKEN"];
    const setEnv = (k, v) => {
      for (const target of ["production", "preview"]) {
        spawnSync("npx", ["--yes", "vercel@latest", "env", "rm", k, target, "--yes"], { stdio: "ignore", shell: isWin });
        spawnSync("npx", ["--yes", "vercel@latest", "env", "add", k, target], { input: v, stdio: ["pipe", "ignore", "inherit"], shell: isWin });
      }
    };
    for (const k of envKeys) if (values[k]) setEnv(k, values[k]);
    ok("Environment variables set on Vercel");
    const first = vercel(["deploy", "--prod", "--yes"], { capture: true });
    const deployUrl = first.out.trim().split(/\s+/).reverse().find((s) => s.startsWith("https://"));
    if (!first.ok || !deployUrl) return fail("Deployment failed. See the output above.");
    let site = (await ask("Production URL (your custom domain, or Enter for the Vercel URL):", { def: "" })).replace(/\/+$/, "");
    if (!site) {
      // The stable project alias (name.vercel.app) beats the per-deployment URL.
      const inspect = run("npx", ["--yes", "vercel@latest", "inspect", deployUrl], { capture: true }).out;
      site = inspect.match(/https:\/\/[a-z0-9-]+\.vercel\.app(?=\s)/g)?.sort((a, b) => a.length - b.length)[0] ?? deployUrl;
    }
    setEnv("NEXT_PUBLIC_SITE_URL", site);
    vercel(["deploy", "--prod", "--yes"]);
    const live = await waitForServer(`${site}/api/status`, 30_000);
    if (live?.ai && live?.supabase) ok(`Live at ${bold(site)}`);
    else warn(`Deployed to ${site}, but /api/status didn't confirm live mode yet.`);
    console.log(`\n  ${bold("One manual step:")} Supabase → Authentication → URL Configuration:`);
    console.log(`    Site URL:       ${site}`);
    console.log(`    Redirect URLs:  ${site}/**`);
    console.log(dim("  (Without this, sign-up confirmation and password-reset emails link to the wrong place.)"));
  }

  step(8, "Live quality benchmark (optional, costs money)");
  console.log(dim("Runs 15 realistic trips through Claude and scores them. Estimated $4–6 per full run (actual cost is printed)."));
  console.log(dim("A single case costs about $0.25–0.40: npm run eval:itinerary -- --only=paris-family"));
  if (!aiErr && (await yes("Run the full live benchmark now?", false))) run("npm", ["run", "eval:itinerary"]);

  console.log(bold("\nDone. ") + "Re-run `npm run go-live` any time; it skips what's already in place.\n");
}

main()
  .catch((e) => fail(e.stack ?? String(e)))
  .finally(() => rl.close());
