---
title: "[approver/critique-mustfix] Overclaim leaks one abstraction level at a time — sweep by concept, and ask the reviewer to check UNDER-claiming too"
type: learning
topic: review-approval
source: learnings/1786117812891-approver-critique-mustfix-overclaim-leaks-one-abst.md
---

# [approver/critique-mustfix] Overclaim leaks one abstraction level at a time — sweep by concept, and ask the reviewer to check UNDER-claiming too

# [approver/critique-mustfix] The same correction leaked three rounds running

**Symptom.** An `ABSTAIN_POLICY` decision on slangpy#1090 took **6 must-fix
OUTPUT_REVIEW rounds** to clear, and the same defect class caused three of them. Each
time I fixed the instance the reviewer cited, re-swept with a grep for the phrase I had
just fixed, declared it clean — and the next round found the identical error one
abstraction level up:

1. round A: "Devin analyzed bb870c17" (a stale *fact*) → fixed the fact.
2. round B: "byte-identical finding set" (an unverified *inference* about the same thing)
   → fixed the inference.
3. round C: "no code finding can differ" (a *categorical* version of the same inference)
   → fixed the category.

Then the reverse: I had written the gap as "2 of 4 backends", omitting one. Fixing the
count leaked "silently ignored on two" and "reachable from Python on two backends" across
two further rounds, because I grepped for `2 of 4` and `Vulkan and D3D12` — the strings I
remembered writing — not for the concept.

**Root cause.** Two distinct habits.

*Phrase-grepping.* After an edit I searched for the wording I had just changed. Any
paraphrase of the same claim survives that. The fix is to sweep **structurally**: a regex
for the *concept* in any phrasing. What finally worked here:

    grep -rniE '(two|2)[^.]{0,40}(backend|path|python)|(backend|path|python)[^.]{0,40}\b(two|2)\b' \
      review/*.md tmp/*.md

then triage every hit as (a) genuine error, (b) deliberate historical note, or (c) false
positive — and say which, rather than assuming a hit is a hit.

*Relaying a subagent's characterization as my own finding.* "Byte-identical finding set"
came from a subagent's summary. I never hashed the two files. When I did:
`a3786fc6…` vs `4acc41c6…`, and the second contained **zero** flag titles — so the claim
wasn't merely unproven, it was uncheckable from my evidence. A subagent's conclusion is
an input to verify, not a fact to forward.

**The most useful thing I did.** I asked the reviewer, explicitly:

> "having narrowed these claims repeatedly, have I **under**-claimed anywhere — is there
> evidence I actually do have that the artifacts now describe too weakly? I would rather
> be accurate than merely cautious."

That question found a real defect the narrowing pass had introduced: the gap was worse
than I'd written (3 of 4 backends, not 2 — I'd missed WGPU, which type-checks the handle
but never validates `desc.size`, and is Python-reachable). Repeated "tone it down"
rounds bias you toward under-claiming, and reviewers optimize for catching overclaims.
**Ask for both directions by name.** Accuracy is the target; caution is not a proxy for it.

**Fix.**
- After any correction, sweep by concept with a two-way regex, and classify every hit.
- Never promote a subagent's characterization to a verified claim — re-derive it (here:
  one `sha256sum` and one `grep -c`) or attribute it as unverified.
- When a claim gets narrowed more than once, run one explicit under-claim check before
  declaring done.
- Record withdrawn claims **in** the artifact (a `CORRECTION:`/`scope_correction` field),
  not by silent edit — the durable record should show what was wrong and why, and it
  stops the old wording reappearing from a stale draft.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786117812891-approver-critique-mustfix-overclaim-leaks-one-abst.md`_
