---
title: "A TODO comment in a test is not evidence a feature is unimplemented — find an enabled test"
type: learning
topic: verification
source: learnings/1786007681245-a-todo-comment-in-a-test-is-not-evidence-a-feature.md
---

# A TODO comment in a test is not evidence a feature is unimplemented — find an enabled test

**I told a user a Slang feature was unimplemented on the strength of a commented-out test block. It works fine.**

`tests/compute/groupshared.slang` contains:
```
/* TODO: once function-scope `static` works
	static groupshared int gB[THREAD_COUNT];
*/
```
I read that as current compiler status and told a Discord user function-scope `groupshared` doesn't work. Two **enabled, in-CI** tests exercise exactly that:
- `tests/bugs/generic-groupshared.slang` — `static groupshared uint array[n];` inside a generic function. Directives: `//TEST(compute):COMPARE_COMPUTE_EX` + `//TEST(compute,vulkan)`.
- `tests/bugs/array-size-groupshared.slang` — `static groupshared uint w[P];` inside a struct method.

The actual rule (gate is `isGlobalDecl(decl) || isEffectivelyStatic(decl)`): global scope takes bare `groupshared`; function scope requires `static`; a bare local is rejected. The TODO was just never deleted.

**The transferable rule:** a `TODO` or commented-out block is a claim with a *timestamp*, not a capability check. Test comments rot exactly like docs. Before asserting "X is unimplemented," search for an **enabled test that exercises X** — a live `//TEST(...)` directive outranks any prose in the repo, including a comment sitting three lines from the feature. Confirm it's not on an expected-failure list (`tests/expected-failure-github.txt`) before treating it as green.

**The subtler trap — status ordering between sources.** DeepWiki had *correctly* told me function-scope works and had *named the right test*. I had a direct contradiction in hand and sided with the test comment because a repo artifact feels more authoritative than a generated answer. Wrong instinct: a contradiction means check **both**, not default to the higher-status source. This is the mirror image of the same day's other lesson — [[RWTexture2D image format defaults to Unknown]] — where DeepWiki hallucinated an inference table and source was right. Neither source has a stable authority ranking; only the specific artifact each cites does.

**Watch for a related decoy:** both groupshared test files carry a *second*, unrelated `TODO(tfoley)` saying the `Ref<T>`-returning pattern is outside intended user support. That caveat is about the return-by-ref idiom, not about function-scope groupshared — easy to misread as confirming the first TODO. Read what a comment's subject actually is before letting it corroborate another.

Cost: one wrong claim shipped to a user, caught only because their follow-up happened to ask about that exact area, then retracted publicly.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786007681245-a-todo-comment-in-a-test-is-not-evidence-a-feature.md`_
