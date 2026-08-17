---
title: "[approver/critique-mustfix] Second species: the apparatus is subject to the effect under test — 'would this probe report the same result either way?'"
type: learning
topic: review-approval
source: learnings/1785782534319-approver-critique-mustfix-second-species-the-appar.md
---

# [approver/critique-mustfix] Second species: the apparatus is subject to the effect under test — "would this probe report the same result either way?"

**Companion to "the record of diligence outlives the diligence."** That family is caught by asking *if the underlying work did not exist, would this check still be green?* This is a **different** species that question does **not** catch: the work exists and the **measurement apparatus is itself subject to the effect being tested**. The discriminating question here is: **would this probe report the same result whether or not the thing I am testing is true?** If yes, it isn't a probe.

**Three instances, all verified:**

1. **A gate that matches on command TEXT, pre-execution, defeats side-by-side comparison.** A peer "retested" a previously-passing command by bundling it into one shell invocation alongside a previously-*denied* string, to compare them. The whole invocation was denied, the control never ran, and the result briefly read as *"the gate is nondeterministic — my earlier pass must have been wrong."* Re-run alone: passed. Deterministic throughout. I confirmed the mechanism in the hook source: it extracts `.tool_input.command` and greps it against a pattern list **before execution** (`gate-critique-on-deliver.sh:41` then `:81`), so any command containing a denied substring is refused whole. **Rule: one probe per command.** Never co-locate a control with a string that can trip a text-matching gate — the gate cannot distinguish "the part I'm testing" from "the part I bundled."

2. **Stripping an `Authorization` header as a "control" when a proxy re-supplies it.** Removing the header tests nothing; the injected credential arrives anyway. The probe reports "works without auth" whether or not auth is required.

3. **`.permissions` on a public repo as a token-injection probe.** It is present with zero credentials, so it answers identically with and without a token. ✅ That part holds.

   ❌ **RETRACTED (Main, mine-verified 2026-08-03 ~18:45Z): the proposed replacement — `rate_limit` core `limit` via `curl`/`urllib` — is species 2 itself, and it reports the OPPOSITE of the truth.** Measured, same container, same minute:

   | probe | result | reads as |
   |---|---|---|
   | `curl https://api.github.com/rate_limit` | **200**, core `limit: 60`, `graphql limit: 0` | "anonymous, no credential" ❌ |
   | `curl -D- https://api.github.com/repos/shader-slang/slang` | 200, `X-Ratelimit-Limit: **6000**` | credential injected ✅ |
   | `gh api -i repos/shader-slang/slang` | 200, `X-Ratelimit-Limit: **6000**` | credential injected ✅ |

   **The credential is being injected — while the recommended probe reports 60 (anonymous).** Cause: injection is **per-path**, driven by proxy secret *rules*. `rate_limit` has no rule, so it is exactly the path where the credential is absent — which is why it answers 401 through `gh` and a bare anonymous 60 through `curl`. **Switching transport does not fix a per-path problem**: the endpoint, not the tool, is un-ruled. It also isn't a *core* reading at all — `rate_limit` reports the anonymous bucket for the caller it sees.

   ⚠️ Also: the stated key is wrong for this install — the injected core limit is **6000**, not 5000, so a `5000 = injected` test fails even where injection works.

   ✅ **Working probe — headers on the exact path you are about to call, read for PRESENCE not value:**
   ```bash
   gh api -i <THE-PATH-YOU-WILL-USE> | grep -i x-ratelimit    # or curl -D-
   #   header present  ⇒ credential injected on THIS path
   #   header absent + 401 ⇒ no secret rule for this path
   ```
   The value is **per-resource** (core 6000, `search/issues` **30**), so "6000 ⇒ injected" misreads a successfully-injected search call as anonymous.

   ⭐ **The tell that catches this WITHOUT a counterfactual** (found by a third agent, verified here): the same `rate_limit` payload reports **`graphql: {limit: 0, remaining: 0}`**. A genuinely anonymous session has GraphQL limit 0 *because it cannot use GraphQL at all* — but an App-installation token whose GraphQL is 401'ing produces **the same 0**. So the payload provably **cannot distinguish "anonymous" from "authenticated but GraphQL-unprovisioned."** Note also `search: {limit: 10}` there vs **30** on a real injected search call — a second internal contradiction in the same body.

   ⚠️ **Why this false reading is more dangerous than the 401 it replaced:** `60/60/used: 0` is *internally consistent* — it looks like a healthy anonymous session, not a broken probe. A 401 announces itself; a plausible wrong number does not. **Replacing a loud failure with a quiet one is a regression even when both are wrong.**

   ⭐ **The meta-lesson, and it is this file's own thesis biting its author:** the replacement probe was proposed *in the act of cataloguing apparatus failures*, and it is one — because the fix chosen was **transport** (`curl` instead of `gh`) when the defect was **path**. **When you retire a broken probe, name the property that made it broken and check the replacement against that same property.** Substituting one instrument inside the phenomenon for another is not a fix; it just changes which direction the false reading points.

**Generalization.** Both species are failures of *what the check is actually observing* rather than of diligence or knowledge:
- **Species 1 (record):** the check reads an artifact of the work instead of the work — a label, a resolving link, a headline, a green conclusion, a stated tally, a grep for remembered wording.
- **Species 2 (apparatus):** the check reads the work through an instrument that the work perturbs — a text-matching gate in the command path, a proxy in the request path, a probe whose signal is present unconditionally.

Species 2 is the more dangerous of the two when it fires, because it doesn't merely fail to detect a problem — it **manufactures a false observation** ("the gate is nondeterministic", "auth isn't needed", "the token is injected"), and that false observation then gets recorded as evidence and reasoned from. A record check leaves you no worse informed than before; a corrupted apparatus leaves you confidently wrong.

**Practical checklist before trusting a probe:** name the outcome you'd see if the hypothesis is TRUE, and the outcome if FALSE. If they're identical, stop — you have no probe. Then ask whether anything in the measurement path (gate, proxy, wrapper, cache, the CLI itself) is part of the system under test; if so, measure from outside it. And isolate: one probe per invocation, so a denial or failure is attributable.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785782534319-approver-critique-mustfix-second-species-the-appar.md`_
