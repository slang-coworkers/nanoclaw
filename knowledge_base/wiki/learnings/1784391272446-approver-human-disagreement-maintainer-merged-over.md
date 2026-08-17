---
title: "[approver/human-disagreement] Maintainer merged over a production-review 🔴 (example-only assert + untrusted-input DoS) — shadow BLOCK correct on the facts, disagreement was on blocking-threshold not correctness"
type: learning
topic: review-approval
source: learnings/1784391272446-approver-human-disagreement-maintainer-merged-over.md
---

# [approver/human-disagreement] Maintainer merged over a production-review 🔴 (example-only assert + untrusted-input DoS) — shadow BLOCK correct on the facts, disagreement was on blocking-threshold not correctness

**Case:** shader-slang/slang#11471 (default-value-blob reflection API, duckdoom5/fork). I recorded BLOCK/RED_BUG twice (R1 @0feba4d397e2, R2 @6b66fb1af24e). PR **MERGED by jkwak-work (COLLABORATOR maintainer, not the author) at the R2 head with the two 🔴s UNFIXED** (merged head == my decision commit; last non-merge commit 92cc67d187aa unchanged). merged ⇒ APPROVED-equivalent → recorded human_verdict=APPROVED on the R2 row. This is a decision/human **disagreement in the SAFE direction** (I blocked, human approved) — NOT a false-safe (I never waved a bug through).

**Was the BLOCK wrong? No — vindicated on correctness.** The R2 production PRIMARY review (github-actions[bot]) that I couldn't obtain within my ~23-min timeout window **did eventually post ~2h later (10:41Z)** and independently confirmed BOTH my 🔴s verbatim: `examples/reflection-api/main.cpp:236` SLANG_ASSERT on the documented null-blob success path, and the `slang-reflection-api.cpp` recursive serializer with no depth guard (it framed the latter as "hang / stack overflow on **untrusted source** — DoS"). So my byte-identical-fallback reasoning was exactly right, and my source-verification matched the eventual PRIMARY.

**Why the maintainer merged anyway — the transferable calibration lesson:** both 🔴s are **low real-world severity** despite being genuine correctness bugs:
- Bug 1 lives in an **example/demo** (`examples/reflection-api/main.cpp`), not the shipping library. A wrong `SLANG_ASSERT` in a sample aborts a demo in debug builds — it does not affect the public API's correctness. Maintainers routinely merge library features with a known-imperfect example and fix the sample later.
- Bug 2 (missing recursion-depth bound) is reachable **only on pathologically deep / adversarial type nesting**, which is outside the threat model for a compiler reflection API fed trusted shader source. "DoS on untrusted source" is a real class, but Slang's reflection consumers compile their own shaders.

The bot review's `🔴 Bug` severity marker (and thus my `any-🔴 ⇒ BLOCK` mapping) does NOT encode this "real-world blocking-ness" axis — it flags correctness defects regardless of trigger reachability or whether they sit in shipping code vs an example. A human maintainer weighs blast-radius + code-location + threat-model and can rationally merge over a correctness-true 🔴.

**How to apply:** The `any-🔴⇒BLOCK` rule is the correct SHADOW-mode behavior (never round a source-verified 🔴 up), and this outcome is a well-calibrated safe-direction disagreement, not an error to correct. But when reporting a BLOCK whose 🔴s are (a) confined to examples/tests/docs rather than shipping API, or (b) reachable only on adversarial/untrusted input outside the component's threat model, **explicitly flag that severity context in the challenger/report** so the human-disagreement is expected and legible on the join — rather than reading as a bug the human missed. A 🔴 in an example + an untrusted-input-only DoS is the archetype a maintainer merges over. Do not soften the BLOCK, but do annotate the severity axis the 🔴 marker omits. Companion: [[pr-11471-decided]]; contrast the false-safe direction (approve-over-🔴) which is the one to hunt.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784391272446-approver-human-disagreement-maintainer-merged-over.md`_
