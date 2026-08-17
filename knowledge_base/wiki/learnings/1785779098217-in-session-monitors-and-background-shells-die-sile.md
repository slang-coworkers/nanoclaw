---
title: "In-session Monitors and background shells die silently on session teardown"
type: learning
topic: agent-ops
source: learnings/1785779098217-in-session-monitors-and-background-shells-die-sile.md
---

# In-session Monitors and background shells die silently on session teardown

**Never end a turn with "monitor armed / the notification will resume me."** In-session `Monitor`
watches and `Bash(run_in_background)` shells do **not** survive container/session teardown. They are
killed **without firing** — nothing wakes you, and long work silently stops mid-flight.

**Evidence:** cost 5 days of maintainer-visible silence on shader-slang/slang#10918. I ended two
consecutive turns that way after publicly telling the maintainer the rework was "building now"; both
verification builds died (one at ~590/1448, one at ~480/1448) and no notification ever arrived. The
maintainer had to nudge twice. My session container had been stopped since the minute I posted.

**What to do instead:**
- **Block in-turn.** Run the build in the foreground and wait: `while pgrep -x ninja >/dev/null; do
  sleep 20; done` then report. Re-invoke the same `cmake --build` if the bash call times out — ninja
  resumes incrementally, so nothing is lost.
- **`Agent` subagents launch async here** despite synchronous-sounding prompts, so they are also not a
  teardown-safe carrier. Fine for keeping build output out of context, but still block on the artifact
  yourself.
- **The durable path is `ncl tasks`, not `schedule_task`.** The `mcp__nanoclaw__schedule_task` MCP tool
  may not be in your allowlist (`mcp_servers: {}`), but `cli_scope: group` grants
  `ncl tasks create|list|get|update|cancel|pause|resume|run|delete` — host-side and teardown-surviving.
  I first reported upstream that I had *no* durable option; that was wrong, I'd only checked for the
  MCP tool. **"The MCP tool is missing" ≠ "the capability is missing" — run `ncl <resource> help`
  before declaring a gap.**
  Shape: `ncl tasks create --name <slug> --prompt '<what to resume>' --process-after <ISO>` (one-shot)
  or `--recurrence '<cron>'`. `--script` is a pre-task gate (bash, 30s, last stdout line must be
  `{"wakeAgent": <bool>, "data": {...}}`); `wakeAgent:false` costs **zero tokens**, so an idempotent
  "has the build finished / has the branch head moved?" gate is cheap. >4 fires/day is refused without
  a gate; 8 consecutive script errors auto-pauses the series.
- **Never post "building now" unless you'll still be alive to report the outcome.** If verification
  can't finish in-turn, say so with a date on the human-facing thread.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785779098217-in-session-monitors-and-background-shells-die-sile.md`_
