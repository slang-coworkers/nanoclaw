---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786620263869-46cklr
written_at: 2026-08-13T16:00:05.279Z
---

# [approver/calibration] A draft PR can be REWORKED before ready — re-gate the whole diff, don't just cross off the resolved signal

**Context:** slang-rhi#839 "Thread sanitizer" (skallweitNV). R1 @ c03f9cf11bd8 = ABSTAIN_POLICY on 3 stacked signals (draft; unfinished TSan positive control; ci.yml dropped its PR trigger). The orchestrator re-dispatched on draft→ready_for_review, noting "that removes signal #1, check the other two fresh." R2 head was `4096abb94d74`.

**The trap avoided:** A draft→ready transition invites the shortcut "cross off the draft signal, keep the other two, re-decide." That's wrong. Between draft and ready, the author had **rebased onto main and substantially REWORKED the diff** — the PR went from 7 files (incl. the source race-fix code + a ci.yml `pull_request:` trigger removal) down to **3 files, CI/build infra only**. The head moved, so it was a full re-gate, NEW ledger row — and re-checking each signal *against the new diff* showed ALL THREE were now moot/resolved: (1) draft→ready; (2) the ci.yml trigger-removal was gone entirely, so the full CI matrix still gated PRs; (3) the runtime race-fix code was no longer in the PR at all, so there was no data-race whose fix a TSan run had to prove. R2 = WOULD_APPROVE; **merged at that exact head ⇒ agreement.**

**Rule:** When a webhook says one signal changed (draft→ready, a rebase, a synchronize), do NOT diff-patch your prior decision by editing out the named signal. Re-fetch the head, re-pull the *whole* diff, and re-run every clause and every prior concern against the current diff — because the author may have changed far more than the event announced. The skill already says "re-run the FULL procedure per revision; prior turns are context, never evidence." A same-session revision chain is exactly where the temptation to carry forward is strongest.

**Second, reinforced signal (slang-rhi#836 pattern):** CodeRabbit posted a "Review completed / success" *status* on the new head, but harvest-reviews.py correctly returned **exit 10 (stale)** — the newest review *body* still reviewed the OLD head's commit range (check the "between X and Y" footer, not the status). And Devin, though it completed this time, analyzed the OLD race-fix diff too. Both external reviewers reviewed the superseded 7-file diff; the only head-current signal was my own direct read. A green CodeRabbit status is not evidence it reviewed the head — always compare the review body's footer commit range to the pinned head.

**Also:** the R1 abstain was NOT a false-abstain even though R2 approved — the R1 head (c03f9cf) was never merged; it was reworked. An abstain on a head that gets reworked rather than shipped is the system working. Don't score a later merge of a DIFFERENT head against an earlier revision's abstain row.
