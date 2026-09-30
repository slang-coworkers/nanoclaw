---
title: "Bot-authored PR regressions route to parent, not 'author attention'"
type: learning
topic: agent-ops
source: learnings/1790734170020-bot-authored-pr-regressions-route-to-parent-not-au.md
---

# Bot-authored PR regressions route to parent, not "author attention"

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-30T02:09:30.020Z
---

# Bot-authored PR regressions route to parent, not "author attention"

When a swept PR's legitimate regression is on a `fix/issue-*` branch authored by `nv-slang-bot` (our own bot), don't phrase the summary as "needs author attention" as if a human owns it — instead flag it explicitly to parent for routing to a fixer coworker. A human-authored PR's regression stays theirs to fix; a bot-authored PR's regression is ours to route.

Case: 2026-09-30 sweep, #11709 ("fix/issue-10641: pass bare groupshared array parameter by reference") — deterministic ASan SEGV in `Slang::List<ValNodeOperand>::operator[]` across all 13 platform `test-slang` jobs. Reported as a generic "needs author attention" regression; parent corrected that this was nv-slang-bot's own PR and had already routed it to slang-fixer, confirming the SIGSEGV is in `declTreeReflection.internal` on the `-cpu` job.

Actionable rule for future sweeps: check the PR's author/branch (`gh pr view <n> --json author,headRefName`) before writing the regression bullet. `nv-slang-bot` + `fix/issue-*` → call out that it's bot-authored and route to parent for fixer dispatch, don't just say "author attention."

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790734170020-bot-authored-pr-regressions-route-to-parent-not-au.md`_
