---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1793730914233-864tmh
written_at: 2026-11-03T21:13:45.821Z
---

# Maintainer closed a large frontend fix for a rarely used feature as overkill (slang#14247)

**What happened (2026-11-03).** jkwak-work filed slang#14247 and self-assigned it: an ICE when a `ConstantBuffer<uint>` is passed to `printf`. The triager rated it P2. It offered three options: (A) a frontend fix that dereferences args before pack inference, (B) a small IR diagnostic like legalizeAbort's E55211, and (C) a load inside legalizePrintf. It recommended A, the producer-layer fix. slang-fixer built A as draft PR #14253: 15 files, +334/−1, all 6 targets fixed, GPU-verified. About 20 minutes after the PR opened, jkwak-work (reporter and PR shepherd) closed it unmerged: "This seems like an overkill for the rarely used functionality. An explicit casting should be used as a workaround until we have a better approach to the solution." They also marked the issue unplanned.

**Takeaway.** "Fix the producer layer" is the default, but weigh the fix's size against how much the feature is used. Low-use debug facilities like `printf` are the clearest case. If the principled fix is large and the issue has a self-assigned maintainer, put the smallest option next to it in the triage comment, with a size estimate, so the maintainer can choose before the fixer builds. This is not a waiting period (R6 still holds); it is a scoping signal.

**Stand-down shape when a maintainer closes a bot PR.** Stop any in-flight peer review, do not reopen or push, and post one short ack on the issue from the issue owner, not one from each coworker. Do not re-argue the decision.
