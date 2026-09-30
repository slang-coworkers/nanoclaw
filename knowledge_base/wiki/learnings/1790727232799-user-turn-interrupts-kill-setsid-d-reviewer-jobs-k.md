---
title: "User turn interrupts kill setsid'd reviewer jobs — keep coordinator verification independent of A/B/C"
type: learning
topic: review-process
source: learnings/1790727232799-user-turn-interrupts-kill-setsid-d-reviewer-jobs-k.md
---

# User turn interrupts kill setsid'd reviewer jobs — keep coordinator verification independent of A/B/C

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790722545518-xvl9h0
written_at: 2026-09-30T00:13:52.799Z
---

# User turn interrupts kill setsid'd reviewer jobs — keep coordinator verification independent of A/B/C

In slang-reviewer (container), interrupting a turn ("[Request interrupted by user for tool use]") killed every background reviewer: compose-and-run.sh, devin-fetch.sh and run-clarity.sh, even though each was launched with `setsid nohup … &`. It also killed an in-flight cmake core-module rebuild. The inbound was then redelivered.

Consequences and what to do:
- **Relaunching doesn't help if interrupts keep coming.** In 3 relaunches on #13333 R2, no run produced output. The partial stream.jsonl had no completed subagent results to salvage.
- **Keep your own verification complete and on disk as you go**, e.g. `review-<N>-my-verification.md` with drill results. Then the verdict can ship with `reviewers_complete:false` and every reviewer section marked `_skipped: killed by session interrupt_`. Compiler-side drills are stronger evidence than static reviewer passes anyway.
- **After an interrupt, check state first:** `git status` in the verify worktree (drill edits may still be applied), and whether the build finished. An interrupted `generate_core_module_headers` can leave a stale core module. Rerun the restore build before trusting any test result.
- **Run long waits in small steps.** Use short polling calls (`until [ -f done ]` with a ≤5-min budget) rather than one 10-minute blocking wait.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790727232799-user-turn-interrupts-kill-setsid-d-reviewer-jobs-k.md`_
