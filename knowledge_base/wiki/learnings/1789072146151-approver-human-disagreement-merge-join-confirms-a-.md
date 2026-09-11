---
title: "[approver/human-disagreement] Merge-join confirms: a narrow CI-green MEMBER-approved parser fix ships with a single-arm coverage gap UNFILLED (slang#12892)"
type: learning
topic: review-approval
source: learnings/1789072146151-approver-human-disagreement-merge-join-confirms-a-.md
---

# [approver/human-disagreement] Merge-join confirms: a narrow CI-green MEMBER-approved parser fix ships with a single-arm coverage gap UNFILLED (slang#12892)

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788545131884-ame9wo
written_at: 2026-09-10T20:29:06.151Z
---

# [approver/human-disagreement] Merge-join confirms: a narrow CI-green MEMBER-approved parser fix ships with a single-arm coverage gap UNFILLED (slang#12892)

## Signal
slang#12892 ("Fix node discard in tryParseGenericApp", Fixes #9810, EXTERNAL contributor
bisqottii, fork head). My R2 decision (@66b77beebfda, under wide policy v0-shadow-wide-r2)
was **ABSTAIN_POLICY:OPEN_GAP** — a critique-gate-enforced revision from WOULD_APPROVE
because the single-overload generic-member-call-through-pointer arm (`as<DeclRefExpr>`)
was untested (the PR's one test forces the two-overload `OverloadedExpr` arm).
**JOIN: MERGED by MEMBER jkwak-work at EXACTLY my decision commit 66b77beebfda
(merge commit 5576c41b19a1, 2026-09-10T20:27), 0 follow-up commits.** So merged ⇒
APPROVED-equivalent (host auto-joins), and BOTH 🟡 gaps — the missing rationale comment
AND the untested single-decl arm — shipped **unfilled**. The abstain is an expected
shadow-mode false-abstain, excluded from agreement scoring.

## What it calibrates (the transferable prior — does NOT change the procedure)
For a fix of this SHAPE, maintainers treat a per-arm coverage gap as non-blocking and
merge unchanged. The shape:
- a NARROW change (here +6 lines) that ENABLES a new branch with multiple accepting arms;
- CI green INCLUDING the specific regression the change was narrowed against (here the
  `as<MemberExpr>(base)` guard was added precisely to stop the E30019 overload-ambiguous-2
  regression; that test is in the suite and passed);
- the untested arm shares the tested arm's EXACT downstream (`base = checkedBase` →
  `parseGenericApp`, `baseKind==Generic`), differing only in the checkedBase node shape;
- a codebase MEMBER approved the exact head, and the primary review + Devin found 0 bugs.
=> real-world risk of the untested arm is low; the OPEN_GAP abstain was correct CONSERVATIVE
routing ("a human must look", which they did), not a code miss.

## How to use it next time (without rounding up)
Shadow mode stays conservative: an untested arm central to a PR's purpose still routes to
ABSTAIN:OPEN_GAP (see the paired procedure learning `[approver/critique-mustfix] A fix that
enables a multi-arm branch needs a test per arm`). This join does NOT license approving such
gaps. It DOES sharpen Step-0 recall: when you see this exact shape (narrow branch-enabling
fix + CI-green-on-the-narrowing-regression + shared downstream + MEMBER approval), record the
gap as low-real-risk and expect an abstain-then-merge — so the abstain is logged as expected,
not flagged as a surprising human-disagreement. The costly error remains a false WOULD_APPROVE;
a false-abstain here costs only a human glance the maintainers were already giving.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789072146151-approver-human-disagreement-merge-join-confirms-a-.md`_
