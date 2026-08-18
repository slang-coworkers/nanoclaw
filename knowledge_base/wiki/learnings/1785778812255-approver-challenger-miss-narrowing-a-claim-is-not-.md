---
title: "[approver/challenger-miss] Narrowing a claim is not testing its premise — and the correct fact was already in my own store (recall failure, not evidence failure)"
type: learning
topic: review-approval
source: learnings/1785778812255-approver-challenger-miss-narrowing-a-claim-is-not-.md
---

# [approver/challenger-miss] Narrowing a claim is not testing its premise — and the correct fact was already in my own store (recall failure, not evidence failure)

# Narrowing a claim is not testing its premise — and check your own store before asserting a premise

Two independent agents (me + the orchestrator) made the **same** error on the same fact, in the same
week, while each holding a note that already recorded the fact correctly. That coincidence is the
finding: the failure mode is **recall**, not evidence-gathering, and narrowing a claim feels like
diligence while leaving the error untouched.

## The pattern

The claim was about shader-slang/slang-rhi Metal CI: *which* residency path the hosted macOS runner
takes. I asserted `m_hasResidencySet == true` (⇒ address map dead code, `find()` never called) and
grounded an OPEN_GAP on it. **The inverse is true.** The orchestrator, independently, wrote
"fallback unexercised", later retracted it to "fallback **unverified**" — and that retraction is the
instructive part:

> **"unexercised" → "unverified" is weaker, same direction, same untested premise.**

Narrowing produces a sentence that is harder to falsify without doing any of the work that would
have falsified it. It reads as calibration and functions as laundering. The premise — *is this
configuration actually reachable/default in CI?* — was never tested in either version.

**And the answer was already on disk.** My own `pr-802` row recorded, marked `FACT`, the verbatim
`GPUFamilyApple6 not supported; using per-encoder useResource fallback` line plus the conclusion
that CI exercises the fallback. The orchestrator's store had the equivalent note, *including* that
it had already inverted a prior claim once. Neither of us grepped.

## How to catch it

- **Before asserting any environment/coverage premise, grep your own store for the distinguishing
  token** (here: `Apple6`). A premise about a *stable property of the CI environment* is exactly the
  kind of fact you have probably already established and forgotten. Cheaper than any log fetch.
- **When you retract, test the premise — don't just weaken the predicate.** Ask: *does my new
  sentence require any observation my old one didn't?* If no, you have not retracted, you have
  hedged. Legitimate retraction changes the **direction** or names the **artifact that would settle
  it**.
- **Cross-check sibling rows in the same subsystem before filing.** Two of my adjacent PR rows
  asserted **opposite defaults for the same flag**; a 30-second grep would have surfaced the
  contradiction long before the human join did.
- **Sweep for the SUPERSEDED wording, not your new phrasing** — grepping your fix cannot match the
  stale text it replaced. The orchestrator's sweep caught a second stale copy 140 lines below the
  edit, plus two index lines still teaching the retracted version. My equivalent sweep found the
  `pr-802` note that had been right all along.

## Bonus: label the evidence class, especially when it becomes load-bearing

My supporting citation was imprecise in a way worth generalizing. I called job `91655709489` "the one
job where the device check failed." Verified: it is `conclusion: **success**`, at a **different
commit**, and ran **0** Metal tests. Two distinct conflations:
- **job-level failure vs device-check failure** — the job passed; the *Metal device init* failed.
- **same-run observation vs cross-job environment inference** — the line came from a different
  commit's log.

The inference is still valid (same job name/label/adapter; `GPUFamilyApple6` is a driver property of
the adapter, independent of whether any shader compiled) — but it must be **labelled** as an
environment inference. Note the same shape appeared in the `pr-802` note, where the line also came
from a different (main-parent) log. **State the evidence class whenever a citation becomes
load-bearing for more than one chain**, because the next reader will otherwise upgrade it to a direct
observation for free.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785778812255-approver-challenger-miss-narrowing-a-claim-is-not-.md`_
