---
title: "A closed CI-flake issue can harbor a real latent bug in the same code path — investigate alt-root-cause comments on their merits (slang #11951 → PR #12114)"
type: learning
topic: ci-tooling
source: learnings/1784152131245-a-closed-ci-flake-issue-can-harbor-a-real-latent-b.md
---

# A closed CI-flake issue can harbor a real latent bug in the same code path — investigate alt-root-cause comments on their merits (slang #11951 → PR #12114)

shader-slang/slang#11951 was a merge-queue flake (`static-const-matrix-array.slang.3 syn (llvm)` test-server RPC drop), closed by maintainer after PR #12056 fixed the actual cause (AVX-512 illegal-instruction in the LLVM JIT on virtualized hosts → test-server child crash → JSON-RPC `waitForResult()/hasMessage()` drop). AFTER the close, reviewer pdeayton-nv commented proposing a DISTINCT latent bug in the same JIT path and asked the bot to investigate. That comment was substantive → the chain re-opened, and the investigation shipped as its own follow-up PR #12114 (dual-approved, merged). Lessons:

**1. A substantive human comment on a CLOSED chain re-opens it — evaluate on merits, don't no-op because "it looks done."** The proposed bug lived in the same file the flake fix touched but was a completely separate defect. "We already closed this / #12056 fixed it" is NOT an answer to a new alt-root-cause hypothesis.

**2. A test-server JSON-RPC drop and a source-level UAF can share a code path but be unrelated causes.** #11951's flake was AVX-512 SIGILL; pdeayton's bug was an object-lifetime UAF in `LLVMBuilder::generateJITLibrary()`. Keep them as separate threads on the same issue; don't conflate. (The issue ended with TWO live threads: the merged UAF fix + a still-open "is the AVX-512 flake fully fixed?" babysitter thread, human-decides-reopen.)

**3. The bug (reusable pattern — C++ object lifetime across a move to an external owner):** `generateJITLibrary()` did `ThreadSafeModule(std::move(llvmModule), std::move(llvmContext))` while the same object still held members BORROWING that module/context (`llvmDebugBuilder`/DIBuilder, the IRBuilders, `llvmLinker`). ORC materializes the module inside `jit->initialize()` (forced when `llvm.global_ctors` present) and frees the context THERE — before `~LLVMBuilder` runs — so the borrowers' tracking-metadata destructors (`~DIBuilder` → `TrackingMDNodeRef` → `MetadataTracking::untrack`) hit a freed context. Fix: reset the borrowers BEFORE the move (2 files, +43/−0). Debug-info-gated (only fires with `-g`, which is why the no-`-g` `syn (llvm)` flake path never tripped it).

**4. Member DECLARATION ORDER is not a fix when ownership moves to an external owner.** Reverse-order member destruction protects the normal member-owned teardown, but once you `std::move` the owner out to a separate object, no declaration order among remaining members helps. Reset-before-move is the fix; reorder is not.

**5. Verify load-bearing tool/library-internals claims against the actual version, and correct your OWN public artifact when the framing was imprecise.** The first root-cause explanation (mine on the issue + the fixer's on the PR) framed it as a version-dependent "ORC frees ctx before ~LLVMBuilder" race. Maintainer juliusikkala correctly pushed back (~LLVMBuilder runs BEFORE the JIT artifact is destroyed). The real mechanism (verified vs LLVM 21.1.2 source) is deterministic freeing INSIDE generateJITLibrary at initialize()-materialization. Fix logic was unchanged, but the explanation was wrong — so I posted a delta correction on my own earlier issue comment crediting the maintainer, and the fixer corrected the PR comment-only. Don't leave a refuted explanation standing on a public artifact.

**6. Static analysis + a codex OUTPUT_REVIEW gate is enough to ship a confident public finding when repro is impossible.** The UAF only reproduces under JIT + `-g` + ASan (not runnable in a GPU-less Linux triage env). The verdict was reached by reading source + LLVM headers, cross-checked by codex (which independently confirmed AND flagged 5 overclaims to soften before I posted). Value of the fix is invariant-restoring, not FileCheck-catchable.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1784152131245-a-closed-ci-flake-issue-can-harbor-a-real-latent-b.md`_
