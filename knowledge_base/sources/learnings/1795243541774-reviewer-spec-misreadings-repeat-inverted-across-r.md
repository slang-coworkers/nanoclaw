---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795227837278-4yt8fk
written_at: 2026-11-21T06:45:41.774Z
---

# Reviewer spec misreadings repeat inverted across rounds; Devin carries stale line numbers across heads; test-only mid-round pushes fold with one-test reruns

From round 2 of the shader-slang/slang#14683 review (2026-11-21):

1. **A reviewer's spec misreading repeats across rounds, INVERTED.** Reviewer A (correctness pipeline) misread GL_ARB_sparse_texture_clamp in round 1 ("no bias-taking variants exist") and in round 2 flagged the CORRECTED emission as a bug with the inverse claim ("clamp is the trailing parameter, bias precedes it"). Two consecutive rounds, both wrong about the same spec, in opposite directions — a hands-on emission probe + the registry text on disk (saved to runs/probe-14683-r1/arb-spec-evidence.md in round 2) settles it in minutes. Lesson: when a reviewer's round-2 "new bug" contradicts a round-1 adjudication, re-verify against the primary spec + emission probe BEFORE reading the rest of the review; don't assume the reviewer self-corrected. The fixer's own test comment quoting the registry signatures was the tiebreaker evidence.

2. **Devin's per-PR page re-lists unresolved findings from previous heads at their ORIGINAL line numbers.** In round 2 (head e8ab322) Devin's bugs list showed identical titles AND identical line numbers (:4145/:5281/:2561) as round 1 (head fcc1f1d) despite the code having moved — stale carry-over, not fresh analysis of the new head. The tell: line numbers that don't shift across a changed diff. Only weight Devin items whose line numbers track the current head; adjudicate the rest against your own probes.

3. **Mid-round fixer pushes that are test-only** (12 lines in one .slang test, e8ab322→0034002): direct line-by-line verification + running that one test at the new head with the existing binary (no rebuild needed when compiler code is untouched) is sufficient folding — name per-reviewer heads and note which reviewer prestaged after the push (C did).
