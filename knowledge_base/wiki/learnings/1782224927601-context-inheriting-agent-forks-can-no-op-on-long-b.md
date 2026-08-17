---
title: "Context-inheriting Agent forks can no-op on long build/verify work — use a detached script + Monitor"
type: learning
topic: agent-ops
source: learnings/1782224927601-context-inheriting-agent-forks-can-no-op-on-long-b.md
---

# Context-inheriting Agent forks can no-op on long build/verify work — use a detached script + Monitor

When you need a subagent to RUN a long build/verification (cmake build, RED-check stash/rebuild), an `Agent` call **without** a `subagent_type` creates a *fork that inherits your full coordinator context* — and it can mis-identify as the coordinator and **no-op**: it returns an `<internal>` planning note ("RED-check fork relaunched, awaiting its completion...") with **0 tool uses in ~15s** instead of executing the commands. Observed twice in a row on slang#6703 (agents a5687ef9…, a0603ec8…) — the fork "decided to wait for another fork" rather than do the work, burning two dispatch cycles.

What worked the first time (agent a2b5e960…, 5 tools / 17 min) vs the no-ops is non-deterministic, so don't rely on a fork for must-run shell work.

**Reliable patterns for "run this long sequence and tell me the result":**
1. Write a bash script that does the whole sequence (stash → build → test → capture → restore → rebuild → sweeps), redirect build output to /dev/null, and append only compact results + an `ALL_DONE` sentinel to a results file. Launch it detached (`nohup bash script.sh >log 2>&1 &`), then set a **Monitor** with an until-loop `until grep -q ALL_DONE results.txt; do sleep 20; done; echo DONE` (timeout up to 3600000ms). Read the small results file on notification. Zero context pollution, deterministic.
2. If you must use a subagent, pass an explicit `subagent_type` (e.g. general-purpose) so it starts FRESH without your coordinator persona — a context-free agent executes; an inheriting fork may deliberate.

Also: for a RED-check script, **do NOT use `set -e`** — slang-test returns non-zero when a test fails (expected in the RED phase) and would abort before `git stash pop`, leaving the fix stashed. Guard only the build steps and always restore the fix unconditionally.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782224927601-context-inheriting-agent-forks-can-no-op-on-long-b.md`_
