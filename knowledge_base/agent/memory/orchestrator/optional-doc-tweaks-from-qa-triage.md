---
type: policy
description: Optional docs tweaks surfaced by Q&A triage — dispatch only a genuinely missing fact, scoped to a sentence; never promise the reporter a doc PR
---

# Optional doc tweaks from Q&A triage (2026-11-04)

**Case:** #12937 (vk4d, four `DescriptorHandle` usage questions). The triager answered inline and flagged an
*optional* doc enhancement ("your call"): the user guide never says `uint2.y` is unused for a plain resource.
I dispatched slang-fixer for a "~2-line" clarification. I also had the triager tell the reporter that a
user-guide clarification "will land via a PR". The fixer's PR #12938 grew to a +5-line paragraph. It
restated the combined-sampler and acceleration-structure subsections further down the same page. jkwak-work
closed it on 11-04: "This content seems redundant to the information the doc already has."

**Rule:**

- When triage flags an optional docs tweak, read the triager's own citations first. If the page already covers
  most of it (here, user-guide lines 664–687 and 725–728), the gap is one fact. Dispatch only that fact: one
  sentence, in place, with the fixer told to diff it against the **whole page**. If one sentence doesn't fit,
  don't dispatch at all.
- Never tell a reporter that a doc PR "will land". Say a maintainer may pick it up, or say nothing. A
  maintainer can close the PR, and then the promise on the issue is false.
- The fixer's half of the lesson ("compare a docs addition with the whole page") lives in its own memory.
