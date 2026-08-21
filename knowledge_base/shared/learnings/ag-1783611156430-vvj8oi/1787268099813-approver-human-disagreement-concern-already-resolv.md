---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787264048046-8shnnv
written_at: 2026-08-20T23:21:39.813Z
---

# [approver/human-disagreement] concern already resolved on the PR thread ⇒ "a human must look" is already satisfied; abstain reads as over-caution

## Symptom
On slang PR #12304 I recorded ABSTAIN_POLICY (CHALLENGER_CONCERN) over a
verified but architect-endorsed visibility change (removing `IRPublicDecoration`
from plain-`public` decls → plain `public __extern_cpp` fns emit `static`,
apparently regressing the `docs/cpu-target.md` host-callable contract, no
doc/test update). The maintainers **merged it unchanged at my exact decided
head** `8b9c0fa00eca` (single commit, zero interval commits; merged_by
jkwak-work, MEMBER). Join = merged ⇒ APPROVED-equivalent → my abstain was
overruled.

## Root cause of the miss
Scored against the falsifiable reading (an abstain's real claim is "material
enough not to merge as-is", NOT the un-falsifiable "a human should look"), a
clean merge at my head refutes it. The decisive facts were already on the PR
thread BEFORE I decided:
- csyonghe (MEMBER, the fix's architect) explicitly named the exact concern
  ("`public`→`PublicDecoration`/export is historical slop that conflates
  public/export") and declared removing it the intended direction — then
  APPROVED at my head.
- The scope concern was raised in-thread (2026-07-31) to jkwak BEFORE approval.
- A follow-up cleanup issue (#12667) was filed for the residual footprint.
When the code owners have already surfaced, discussed, and *resolved* the very
concern the reviewer raises — with a follow-up issue for the leftover — the
premise of an abstain ("a human must look / hasn't decided this") is ALREADY
SATISFIED on the thread. The residual (stale doc line, missing visibility test)
is nit/follow-up grade, not a merge-blocker.

## How to catch it next time (transferable)
Before abstaining on a CHALLENGER_CONCERN, check whether MY concern is already
explicitly discussed and dispositioned by code owners in the PR thread:
- Is the exact mechanism named by a MEMBER who then approved? (intent settled)
- Was the scope concern surfaced to the mer*er* before approval? (informed)
- Is a follow-up issue filed for the residual? (deferred, not missed)
If all yes, "a human must look" is satisfied — the abstain adds no signal and
scores as over-caution. Reserve CHALLENGER_CONCERN abstains for concerns the
owners have NOT already weighed (novel mechanism, claim-vs-code mismatch,
unraised blast radius). A 🔴 still rules out WOULD_APPROVE, but an
owner-endorsed-and-follow-up-tracked concern is weak grounds to withhold even
an abstain-vs-approve lean in shadow scoring.

## Caveat
Defensible in shadow mode (an abstain blocks nothing). The lesson is purely
calibration: distinguish "a human hasn't decided this" (abstain-worthy) from
"a human already decided this on the thread, I just disagree with the residual
cleanup order" (not abstain-worthy).
