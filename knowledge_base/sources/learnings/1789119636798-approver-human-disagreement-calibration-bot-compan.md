---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788481356485-mgy3e9
written_at: 2026-09-11T09:40:36.798Z
---

# [approver/human-disagreement] Calibration: bot companion-retype + pinned-dep bump merged clean at the exact abstained commit — abstains were correct deferrals

## Outcome (calibration signal)
slangpy#1135 MERGED by maintainer jkwak-work at head `84c0e99394…` — the EXACT commit
of my R4 decision, with the exact diff I evaluated (external/CMakeLists.txt pin bump +
the 2 unchanged .slang retypes). No commits landed between my decision and the merge.

## My calls vs the human outcome
All four revisions (R1 5e22055, R2 f0b54bb, R3 eadd30f, R4 84c0e99) were
ABSTAIN_POLICY — R1–R3 on CLAUSE_FAIL:author_trust (bot/CONTRIBUTOR author), R4 adding
CLAUSE_FAIL:no_protected_paths (the SGL_SLANG_VERSION pin bump touches
external/CMakeLists.txt). Human outcome = merged = APPROVED-equivalent. ABSTAIN rows
are excluded from agreement scoring, so this is not a false-safe; it is the INTENDED
resolution — a bot-authored, protected-path change was deferred to a human, who merged
it. The clean merge at my exact commit with zero follow-up fixes confirms my read of
the change was complete and correct.

## Transferable class + the positive controls that made this shape safe
Class: a bot-authored SlangPy *companion* PR that (a) mirrors a MERGED upstream Slang
breaking change with a byte-stable local diff, and (b) bumps the pinned
`SGL_SLANG_VERSION` to a release cut AFTER the upstream change merged. Two checkable
positive controls gave real confidence here (beyond "no red flags"):
  1. The retype was exercised green in Slang CI via the cherry-pick
     (`ci-slangpy-trigger-test.yml` `SLANGPY_CHERRY_PICK_PR: "1135"`; #12986 merged
     with SlangPy tests passing) — a genuine positive control that the local diff
     compiles+tests against the real breaking change.
  2. The pin-bump target release (`v2026.17.1`, published 2026-09-11) was cut AFTER
     the upstream merge (#12986, 2026-09-10) — so it plausibly contains the needed
     symbol. Confirm by the pinned-build matrix going green.
Takeaway for Step-0 recall: on this class, the shadow-mode abstains are correct (bot
author + protected build-file touch rightly need a human), AND the two controls above
are exactly what a future reviewer/human should check to gain merge confidence. Merged
clean ⇒ this shape was safe for those reasons.
