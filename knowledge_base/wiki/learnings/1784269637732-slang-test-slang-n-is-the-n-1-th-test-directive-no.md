---
title: "slang-test `.slang.N` is the (N+1)th //TEST directive, NOT a flaky-run index — don't blanket-label as flaky"
type: learning
topic: slang-compiler
source: learnings/1784269637732-slang-test-slang-n-is-the-n-1-th-test-directive-no.md
---

# slang-test `.slang.N` is the (N+1)th //TEST directive, NOT a flaky-run index — don't blanket-label as flaky

# `<file>.slang.N` is a sub-test (directive) index, not a run/retry index — verify the directive's code path before calling a recurring failure "flaky"

**Verified at HEAD** in `tools/slang-test/slang-test-main.cpp`:
- `runTestsOnFile` (:5099-5122): `Index subTestIndex = testOrder[orderIdx]; ... outputStem << "." << subTestIndex` (appended only when `!= 0`). `subTestIndex` indexes `testList.tests` — the list parsed from the file's `//TEST` directives.
- `insertSubtestIndex` (:4926): *"Insert a subtest index into a test name … 'foo.slang (vk)' with index 0 -> 'foo.slang.0 (vk)'"*.

So `gh-9931.slang.1` = **sub-test index 1 = the second `//TEST` directive**, categorically NOT a flaky-run/attempt counter. The `.N` numbering is deterministic and stable across runs.

**Why this bites in triage (slang #11595 / gh-9931, 2026-07-17):** the fixer twice dismissed `gh-9931.slang.1` as a GPU flaky. jkwak pushed back — it was a **real regression from the PR**. Directive `.1` there is the `CHECK_NV` **codegen** variant (`computeMainNV`, `spirv-asm`), which is *deterministic, not GPU-dependent*. The PR's new E41303 alignment contract turned the test's `Store<DescriptorHandle>(4, h, 8)` (`4 % 8 ≠ 0`) into a hard error → empty output → CHECK_NV matched nothing → **consistent** failure that merely looked like a flaky. Fix: drop the dishonest promise-8 → plain `Store<DescriptorHandle>(4, h)` scalarizes identically; CI green.

**Rules:**
1. Before labeling any recurring `.slang.N` failure "flaky", open the file, count to the (N+1)th `//TEST` directive, and read what it actually exercises. A `.N` you'd assume is a GPU run may be a deterministic codegen/asm check.
2. The same `.N` index maps to totally different things in different files — e.g. `static-const-matrix-array.slang.1` is a `(vk)` GPU flake, but `gh-9931.slang.1` is a deterministic spirv-asm codegen check. Never infer the nature of `.N` from a same-named sibling or from the index number; read the directive.
3. Ask whether your own change reaches that directive's code path. A frontend/legalization contract change *can* make a deterministic codegen test fail consistently (empty output → CHECK matches nothing), which is the opposite of flaky.

Related: [[static-const-matrix-array-two-distinct-flake-signa]] (the `(subtest index, target, failure mode)` tuple is the flake identity), [[a-closed-ci-flake-issue-can-harbor-a-real-latent-b]] (a flaky-looking failure can be a real bug — investigate on merits).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784269637732-slang-test-slang-n-is-the-n-1-th-test-directive-no.md`_
