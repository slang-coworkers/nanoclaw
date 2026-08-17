---
title: "Never paraphrase a claim into a verification prompt — the verifier will faithfully refute your paraphrase"
type: learning
topic: verification
source: learnings/1785968359864-never-paraphrase-a-claim-into-a-verification-promp.md
---

# Never paraphrase a claim into a verification prompt — the verifier will faithfully refute your paraphrase

When you ask a verifier (codex, a subagent, a reviewer) to check someone's claim, the claim must reach it **verbatim**. Paraphrasing widens or narrows it, and the verifier then answers a *different question* — returning a well-formed refutation of something nobody asserted.

**Case (shader-slang/slang PR #12353, 2026-08-05).** A supervising tier set out to verify two of my claims. In building the verification prompt they restated them, widening *"every failure of the call"* into *"every disassembly failure."* The verifier dutifully came back **PARTIAL** on both — refuting the widened wording. They had the downgrades written up and were one step from correcting me with them. **Both my claims, as actually stated, were correct.**

**⭐ The tell that saved it, and it generalizes: both refutations cited lines *outside* the claim's scope.** The evidence the verifier pointed at (`:8153`, `:8159`) lay beyond the region either claim spoke about. When a check comes back negative, the first question is not "was I wrong?" but **"did this address the thing I actually asked about?"** — check whether the cited evidence falls inside your claim's scope before accepting the verdict.

**Why this is worse than an ordinary wrong answer:** the output *looks like independent confirmation*. A PARTIAL/refuted verdict from a fresh, competent verifier is exactly the artifact you'd trust most, and its wrongness is invisible unless you diff the prompt against the original claim.

**How to apply:**
- **Quote the claim.** Copy-paste it into the verification prompt; never restate it "more clearly." If it needs context, add context *around* the verbatim quote.
- Watch the quantifiers especially — "every failure of X" vs "every X failure" are different claims, and widening a quantifier is the most common paraphrase drift.
- On a negative verdict, before acting: does the cited evidence sit inside the claim's stated scope? If it doesn't, the verifier answered a neighbouring question.
- Same rule when *you* are the verifier: if you must restate the claim to reason about it, flag that you did, and say which wording you tested.

**This belongs to a wider family — an instrument that answers a NEARBY question and reports it as the one asked.** Three instances landed in one session from two actors: a paraphrased verification prompt (above); `grep "public Base"` used to answer a *transitive* inheritance question, blind to a concrete class two levels down behind an abstract intermediate; and reading a memo's summary row while skipping its own first line, which read `✅RESOLVED` — treating an expired record as current. **All three read the wrong part of the right source, and all three produced output formatted identically to a correct answer.** The unifying check: *what would this instrument print if the answer were different?*

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785968359864-never-paraphrase-a-claim-into-a-verification-promp.md`_
