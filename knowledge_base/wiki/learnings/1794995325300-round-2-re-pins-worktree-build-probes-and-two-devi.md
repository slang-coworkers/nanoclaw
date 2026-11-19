---
title: "Round-2 re-pins, worktree-build probes, and two Devin/refutation patterns (#14581 r2)"
type: learning
topic: ci-tooling
source: learnings/1794995325300-round-2-re-pins-worktree-build-probes-and-two-devi.md
---

# Round-2 re-pins, worktree-build probes, and two Devin/refutation patterns (#14581 r2)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794988998851-922alk
written_at: 2026-11-18T09:48:45.300Z
---

# Round-2 re-pins, worktree-build probes, and two Devin/refutation patterns (#14581 r2)

Two operational gotchas from #14581 round 2 (2026-11-18):

1. **Re-pinning review worktrees when a PR merges master mid-chain:** the bare (bare-<pr>.git) has NO alternates in practice (self-contained object store), so `update-ref` to a new base fails "nonexistent object". Fix that worked: `git -C bare-<pr>.git fetch /workspace/agent/slang +<exact-base-sha>:refs/heads/master` — fetch the EXACT sha, never slang's local `master` branch (which a concurrent session had pinned to an unrelated PR base 540efb73f; fetching it first clobbered the bare and had to be redone). Then `git fetch --depth 50 origin master` in revA/revC. Verify with `git log --oneline -1` before dispatch.

2. **A freshly configured review worktree build misses libslang-llvm.so in build/Release/lib** (prebuilt lands in build/slang-<ver>-linux-x86_64/lib/) — slangc then fails every -emit-cpu-via-llvm compile with a bare E00028 "unable to generate code for target", which looks exactly like a PR regression but isn't. Fix: symlink the prebuilt into build/Release/lib before probing. Also: `git apply` of the PR diff into wt-<pr>-revA + `cmake --preset default -DSLANG_ENABLE_DXIL=OFF` + release slangc build works fine for adjudication probes after A finishes with the tree (revert source with `git checkout -- .` afterward; submodules need `git -c protocol.file.allow=always submodule update --init --recursive` first — miniz/unordered_dense/cmark were missing).

Probe results worth reusing: `__intrinsic_asm` with an undefined callee dies at inline-IR ingestion (E99997 assert, "use of undefined value") before reaching the module verifier — so it is NOT a valid verifier-failure test trigger; pre-fix master, `export __extern_cpp` + cbuffer on -target llvm-host-ir crashes E99997 ("Unsupported instruction for LLVM target"), post-fix compiles clean with `ptr %kernelContext` — Devin flagged this as a bug twice (title-only) and live probes refuted it both times.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794995325300-round-2-re-pins-worktree-build-probes-and-two-devi.md`_
