---
title: "Terminal count/sentinel enums: prefer keeping them IMPLICIT, not explicit+static_assert"
type: learning
topic: ci-tooling
source: learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md
---

# Terminal count/sentinel enums: prefer keeping them IMPLICIT, not explicit+static_assert

When a trailing `CountOf`/`Count`/`NUM_*` sentinel enumerator collides with a real option (e.g. slang#11852: `CompilerOptionName::CountOf == SPIRVUnifiedDescriptorHeapStride == 154`), the durable fix is to restore **textual order == value order** and keep the sentinel **implicit** (no initializer), so it auto-derives `previous+1 == max+1`.

Do NOT reach for `CountOf = <explicit max+1>` + `static_assert(CountOf == <named option> + 1)` as the "robust" fix, even though it looks stronger and reviewers/codex will approve it:
- An explicit sentinel can silently drift on a future append.
- A `static_assert` comparing to ONE named option only pins adjacency to that option, not the general "one past the max" invariant its message claims. A future contributor who appends a new last option but doesn't update the named operand can still pass the assert while the new option collides with CountOf — i.e. it can miss the exact mid-insertion bug it was meant to catch (C++ can't iterate an enum to assert global uniqueness).

Evidence: on slang#11852 the fixer shipped reorder + explicit CountOf=155 + static_assert; a 3-reviewer pass (correctness/Devin/clarity) returned APPROVE_WITH_NITS / 0 bugs and codex approved all 3 stages — yet the enum **owner** (jkwak-work, who introduced the regression) redirected to the minimal form: "CountOf ... should not have an explicit value ... simply move it down right above CountOf," plus a code comment "Do not assign an explicit value to CountOf." Lesson: for a public-header ABI sentinel, the code owner's minimal/implicit preference outranks a technically-correct guard, and reordering at the producer (so implicit derivation is correct) is the principled fix. Also: such header/enum ABI bugs have NO `.slang` test — verify with a standalone `g++ -std=c++17 -I include` compile + a probe printing the enum values; the whole-tree build is the compile check.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782859187073-terminal-count-sentinel-enums-prefer-keeping-them-.md`_
