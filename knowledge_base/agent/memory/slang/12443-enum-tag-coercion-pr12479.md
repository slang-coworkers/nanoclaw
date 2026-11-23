---
type: chain
title: "slang#12443 — enum tag-type coercion source-order bug; fix PR #12479 (re-review round)"
description: August chain's PR #12479 had jkwak... jvepsalainen-nv CHANGES_REQUESTED (2026-09-17); fixer wake dispatched 2026-11-20 to merge master (not rebase), address two review asks, and reply on the PR. Child of umbrella #14478 re-check.
tags: [slang, enum, coercion, pr-update, 14478, jvepsalainen-nv]
---

# slang#12443 — enum tag coercion / PR #12479

Bug: `E(N)` in a generic array bound fails when the enum decl hasn't been driven to
`DeclCheckState::ReadyForLookup` (`EnumDecl::tagType` is null; int→enum coercion at
slang-check-conversion.cpp:2204 reads it without driving). Root cause published on the
issue by the August 2026 chain (sibling session — not in this memory; maintainer go-ahead
from jvepsalainen-nv 2026-08-10). No memory record of that chain existed before 2026-11-20.

**PR #12479** "Ensure an enum is checked before reading its tag type during coercion"
(branch `fix/issue-12443`, opened 2026-08-11, not draft, CI green). Human review
**jvepsalainen-nv, 2026-09-17, CHANGES_REQUESTED**:

1. Test the re-entrancy shape #12927 found (self-referential enum base during a conversion
   check): either justify in the `ensureDecl` comment why it can't reach here (enum state when
   a conversion is checked, citing a test) or land the same `isBeingChecked()` guard #12927 did.
2. Both `SLANG_ASSERT(tagType)` → `SLANG_RELEASE_ASSERT` (same call #12925 made).
3. Red macOS CI job was sccache-setup infra; re-run after branch update.
Their overall fix direction was endorsed ("driving the enum to ReadyForLookup … is the right fix").

**2026-11-20 (umbrella #14478 re-check, task recheck-14478-umbrella-de10):** branch CONFLICTING
with master. Dispatched slang-fixer on canonical thread `gh-issue-shader-slang/slang-12443`
(send id 37, in_reply_to triager report msg 2): **merge master** into the branch (NEVER
rebase/force-push a human-reviewed PR — #12194 rule), address both asks, push, reply to the
review threads with a PR comment; do NOT re-request review (human click; fixer spine forbids).
No pr-mapping row for #12479 existed at dispatch time (August predates report_pr_created?) —
if the fixer re-reports ownership via report_pr_created this gap closes; otherwise #12479
webhooks fall through to the fix/issue-12443 branch convention → slang-fixer.

**2026-11-20 09:19Z — fixer resumed (msg 54), live state corrects the handoff:** the review was
already ANSWERED 2026-09-17 by the prior chain (bot reply cmt 5710997653, pushed `2a81e0c2c1`):
- Re-entrancy ask: DONE, outcome (b) — built repros showing the path DOES reach conversion sites
  mid-check; `!checkState.isBeingChecked()` guards at BOTH sites + regression tests
  `enum-self-referential-base-conversion.slang` / `-tag-coerce.slang`.
- `SLANG_RELEASE_ASSERT` ask: DECLINED with reason — on the guarded path `tagType` is legitimately
  null for a mid-check enum, so a release assert would abort while the proper `E40002` cyclic
  diagnostic should surface; int→enum keeps `if (!tagType) return false`, enum→tag gates only the
  tag-dependent branches. Maintainer silent since 09-17 — this is a normal review-disagreement
  left to them, not a blocker.
- CLA now signed; head `3ef212c31` (Nov-16 catch-up merge); branch CONFLICTING again (master +36).
Fixer plan: merge master, verify + rebuild, push, post summarizing PR comment, R4 stays
declined-with-reason. Delivery-watch one-shot `recheck-12443-fixhandoff-bee9` (15:30Z 11-20)
armed before pickup was confirmed — cancelled 10:00Z after completion.

**2026-11-20 09:58Z — Fix Report, VERIFIED against GitHub (chain complete from our side):**
merge commit `2b75fc823` (master +36, no rebase/force-push, no new code; master had moved
slang-check-conversion.cpp to source/slang/semantic-checking/ — guards intact at :2262/:2352).
Local build green (enums 122/122, 12926-suite 3/3, generics 444/444, interfaces 192/192,
conversions 52/52; formatting clean); fresh CI auto-triggered by the push. Summarizing comment
posted 09:47:28Z (cmt 7036370634), explicitly asking jvepsalainen-nv to rule on R4 or name a
placement. Head MERGEABLE, CHANGES_REQUESTED decision predates the answering commits.
**Resting on human re-review — do not re-request (fixer spine forbids); CI failures route via
branch convention to slang-fixer (no pr-mapping row for #12479).**

Verify-from: PR #12479 state (open/conflict/review) is the system of record; don't trust
message-only status.
