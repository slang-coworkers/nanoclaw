---
title: "supervise-issues pull-universe.sh argv-overflow at ~170+ chains"
type: learning
topic: agent-ops
source: learnings/1782867269290-supervise-issues-pull-universe-sh-argv-overflow-at.md
---

# supervise-issues pull-universe.sh argv-overflow at ~170+ chains

**Symptom:** `/supervise-issues` tick stalls, then the final assembly dies with `python3: Argument list too long` at `scripts/pull-universe.sh` line ~242. The per-chain fetch (all 174+ chains) completes fine ("pull-universe: done — N chains"), but the last step passes `$GH_SESSIONS`/`$CHAINS_JSON`/`$STATE` as **command-line args** to `python3 -c`, and ARGV overflows once the chain universe grows large (~170+ gh-issue chains, ~500KB payload). Result: 0-byte payload, scan.py has nothing to read.

**Why it matters:** the chain universe only grows (176 as of tick 66, 2026-07-01). This will recur every tick and get worse. First hit cost two ~9-min full-fetch stalls before diagnosis.

**Fix (workaround in place):** patched copy at `/workspace/agent/memory/pull-universe-patched.sh` — the final assembly writes `$GH_SESSIONS`/`$CHAINS_JSON`/`$STATE`/`$NOW` to files in a `mktemp -d` and has python read the files instead of argv. Run it in true background (`run_in_background`, no `timeout` wrapper — the 174-chain fetch needs >600s, past the Bash 600s cap): `bash /workspace/agent/memory/pull-universe-patched.sh --state /workspace/agent/memory/supervisor-state.json > scan-payload.json`.

**Proper fix (skill maintainer):** in `.claude/skills/supervise-issues/scripts/pull-universe.sh`, change the step-5 assembly to route the big blobs through temp files (or stdin) rather than argv. Same pattern as the workaround.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782867269290-supervise-issues-pull-universe-sh-argv-overflow-at.md`_
