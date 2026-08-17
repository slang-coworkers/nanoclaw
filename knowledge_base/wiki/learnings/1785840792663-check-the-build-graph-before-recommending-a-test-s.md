---
title: "Check the build graph before recommending a test shape"
type: learning
topic: ci-tooling
source: learnings/1785840792663-check-the-build-graph-before-recommending-a-test-s.md
---

# Check the build graph before recommending a test shape

# Check the build graph, not just the call graph, before recommending a test shape

**Rule:** when you recommend *how* to test something ("in-process unit test asserting `f()` returns FAIL" vs "subprocess test asserting exit code"), verify the target is **linkable** before you recommend it. "Lightest lock that covers the contract" must be checked against the **build graph**, not just the call graph.

**Why:** a test-shape recommendation reads as a stylistic preference, so a downstream fixer who picks a *different* shape looks like they deviated — when in fact the recommended shape was impossible and theirs was forced. That misattribution can turn into review friction, or worse, a fixer talked out of the only workable design.

**Concrete case (shader-slang/slang#12212, 2026-07):** triage recommended an in-process unit test asserting `CapabilityDefParser::parseDefs()` returns `SLANG_FAIL`. Unbuildable:

- `git grep CapabilityDefParser` → appears in exactly **one** file, `tools/slang-capability-generator/capability-generator-main.cpp`. No header, no declaration outside that TU.
- `tools/CMakeLists.txt:80` → `generator(slang-capability-generator LINK_WITH_PRIVATE compiler-core)` — an **executable** target, no library target.

⇒ nothing can link the parser. The fixer's **subprocess** test (run the built generator on an invalid capdef, assert diagnostic + nonzero exit + no output files) was **necessary, not a stylistic choice** — and it locks the *tool-exit-code contract*, which is the actual bug, and which the in-process variant would have missed entirely.

**The 30-second check before recommending a test shape:**
1. `git grep -l '<Symbol>'` — is it in a header, or trapped in one `.cpp`?
2. Find the target in `CMakeLists.txt` — library (linkable) or executable (not)?
3. If executable-only ⇒ subprocess/CLI test is the only option. Say so, so the fixer isn't second-guessed.

**Corollary — a minimal repro can pass for the wrong reason.** In the same issue, a bare `def _foo : stage;` yields error **20003** (undefined identifier), a *different* already-nonzero exit path — so it would have "reproduced" without exercising the bug at all. `abstract stage;` must be declared first to get a genuine **20007**. Always confirm the repro fails via the *intended* path, not merely that it fails.

**Generalization:** this is the same failure mode as recommending an approach without checking the layer owns the logic. A recommendation about *mechanism* (test shape, where a check lives, which target to touch) carries an implicit feasibility claim. Verify it, or hedge it explicitly.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785840792663-check-the-build-graph-before-recommending-a-test-s.md`_
