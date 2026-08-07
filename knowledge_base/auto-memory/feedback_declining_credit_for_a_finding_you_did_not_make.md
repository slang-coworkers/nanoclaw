---
name: feedback_declining_credit_for_a_finding_you_did_not_make
description: "A counterparty's summary of YOUR finding can be more generous than what you wrote — diff their credit against your posted text (not your memory) and decline the excess, because inflated credit silently inflates the weight your future reviews carry"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 329e3eae-9f04-4718-ad1e-659137631367
---

**Measured 2026-08-06, slang-coworkers/nanoclaw#1084.** After I posted a 2-blocker review, szihs fixed
both, found a THIRD bug himself (the branch had no `apt-get` block at all, so the hardened base's
stripped `jq`/`python3`/`gh` were never restored), and wrote in his reply:

> *"You were right that this PR doesn't install Python."*

**I never said that.** Diffed his credit against my POSTED TEXT, not my recollection:

```
my #1084 review — python3=0  python=0  jq=0  ' gh '=0  apt-get=0  hooks=0
controls        — claude-trace-wrap=4  IMAGE_BASE=3  install-slug=2  WORKDIR=2
```

What I *had* written lived on a **different PR (#1096)** and was much narrower — a cross-branch
reference check ("`Dockerfile.derived` / `build-derived.sh` don't exist at head or on `nv-main`; they
live only on #1084"), i.e. *your comment cites files that aren't here*. Not *this branch fails to
install python3*. And I had hedged explicitly the OTHER way: *"the hardened-image python3 story may not
bear on whether this line works at all."*

⇒ **The third fix was his. I said so in the re-review and declined the credit.**

**Why:** ⭐⭐⭐**inflated credit is not a courtesy problem, it is a CALIBRATION problem.** A reviewer
credited with a finding they did not make gets weighted as more thorough than they are, and the next
review's unhedged claim gets less scrutiny than it needs. The cost lands later, on a claim that is
actually wrong. This is the mirror of [[feedback_deference_drifts_to_whoever_corrected_you_last]] — that
one is *adopting a corrector's figure over your own correct one*; this one is *accepting a corrector's
flattering account over your own record*. **Both replace a measurement with a social signal; both are
caught by re-reading your own output.**

⭐⭐ **The check is cheap and must run against the ARTIFACT, not memory.** I genuinely half-believed I
had raised it — the #1096 paragraph *felt* adjacent, and adjacency is exactly what memory smooths over.
`gh api .../issues/comments/<id> --jq .body` + a term census with positive controls settles it in one
call. **Do this whenever a counterparty summarizes your finding back to you in stronger terms than you
remember writing** — the direction of the error is the tell: summaries drift toward whatever made the
reply coherent, and a fixer explaining why he changed something reaches for the reviewer as the reason.

⚠️ **Do not overcorrect into refusing credit you DID earn.** In the same round my hypothesis about
🔴1's *cause* — "the file exists untracked on the build machine, which is why the author's own
verification passed" — was confirmed verbatim by the fix commit. **Claim that plainly.** The rule is
per-claim accuracy in both directions, not performative modesty.

✅ **Companion habit from the same round:** when a residual grep hit survives a fix (`IMAGE_BASE` still
1 occurrence after the snippet was deleted), **check WHERE it lives before re-reporting** — it was
inside the new explanatory comment describing the old bug. Re-reporting it would have been a
manufactured finding, the costlier instrument failure ([[technique_keeping_this_store_reachable]]).

Related: [[project_nanoclaw_1084_derived_hardened_image]] · [[feedback_published_negative_env_claims_need_rederivation]]
