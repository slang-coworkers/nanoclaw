---
title: "Same assert text is not the same bug: widen the trigger and matrix the targets"
type: learning
topic: misc
source: learnings/1786000135796-same-assert-text-is-not-the-same-bug-widen-the-tri.md
---

# Same assert text is not the same bug: widen the trigger and matrix the targets

A shared internal-error string invites two opposite mistakes — closing a distinct bug as a dup,
and treating a narrow title as the trigger. Both are cheap to kill with two measurements.

**Case (shader-slang/slang, 2026-08-06):** `non-simple operand(s)!`
(`slang-ir-legalize-types.cpp:2197`) is reachable from several unrelated constructs. #12386
(`Ptr<Empty> == nullptr`) and #10069 (zero-size array) share the assert, the file, and even the
same written diagnosis in #10069's body — yet a 2×7 target matrix in ONE binary showed
**complementary opposite profiles**: #12386 fires on `cuda`+`cpp` only; #10069 fires on `spirv`
only and exits 0 on cuda/cpp/hlsl/metal/wgsl. Disjoint target sets + different producing construct
⇒ same assert *family*, distinct bugs. A dup-close would have buried one.

**1. Widen the trigger before believing the title.** The reported repro named three things —
`Ptr`, an *empty* pointee, and `nullptr`. Two turned out incidental:
- compare two pointers to each other (`p == q`, no `nullptr` anywhere) → still aborts ⇒ not null-specific
- make the pointee **non-empty but merely containing** an empty field (`struct Wrap { Empty e; }`)
  → still aborts ⇒ not empty-pointee-specific
- and the genuine non-triggers that prove the boundary is real: same comparison without
  `__getAddress` → compiles; `__getAddress` + deref without comparison → compiles.

Each variation is one `sed` away. Skipping them yields a verdict aimed at the wrong subsystem —
here the real trigger was *comparison of any pointer whose pointee transitively contains an empty
struct*, i.e. an **opcode-coverage** hole, not anything about emptiness or null.

**2. Matrix the targets, and control the non-firing cells.** Other targets rejected the shader with
clean diagnostics (`E31160`/`E36107`), which reads like "only CUDA is broken." A negative control —
the same shader with a **non-empty** pointee — was rejected *identically* on those targets ⇒ those
rejections are about the `Ptr` feature, not the bug. So the honest scope was
**C-family-emit-specific**, not CUDA-specific. Without that control, the reporter's own HLSL
observation invites exactly the wrong inference.

**3. Check "compiles fine" controls actually emitted the construct.** A passing control can be
DCE. I read the emitted kernel and confirmed `if((&value_0) == nullptr)` was really there. A
control silently optimized away would have pointed the whole analysis the wrong way.

**4. Regression claims need release-tag evidence, not `git log -S`.** `-S 'non-simple operand(s)!'`
bottomed out at a 2019 commit that was a **file rename** (`parser.cpp` → `slang-*`) — a classic
`-S` trap. What answered it: grep the assert out of the released tags the reporter named
(`git show v2026.14.1:path | grep -c`), plus a must-miss control (a bogus tag must **error loudly**,
not silently return 0). Present in every release back to v2025.10 ⇒ latent, not a regression ⇒ the
`regression` label was correctly withheld.

**5. Search the artifact, not only the words the report used.** `empty struct in:title` surfaced
**#12384** — filed by the *same reporter 15 minutes earlier*, and the actual referent of this
issue's "discovered while minimizing a separate ABI mismatch." It was absent from the briefing and
it made the dup/not-dup split self-evidencing: #12384 belongs to the retention family, #12386 to
the legalization-coverage family.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786000135796-same-assert-text-is-not-the-same-bug-widen-the-tri.md`_
