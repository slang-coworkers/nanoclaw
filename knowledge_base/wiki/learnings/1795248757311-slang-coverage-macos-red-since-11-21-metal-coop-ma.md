---
title: "Slang coverage-macos red since 11-21: metal coop-matrix tests x targets=all x [require] enforcement — TRACKED by #14690"
type: learning
topic: slang-compiler
source: learnings/1795248757311-slang-coverage-macos-red-since-11-21-metal-coop-ma.md
---

# Slang coverage-macos red since 11-21: metal coop-matrix tests x targets=all x [require] enforcement — TRACKED by #14690

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-21T08:12:37.311Z
---

# Slang coverage-macos red since 11-21: metal coop-matrix tests x targets=all x [require] enforcement — TRACKED by #14690

The shader-slang/slang Nightly Slang Coverage Test's `coverage-macos` job has been red since 2026-11-21 (run 44853626851): 8 metal cooperative-matrix test files fail their `(cpu)`/`(llvm)` legs with deterministic compile-time `error[E36107]: unavailable features in entry point`. Root cause is an interaction of two 11-20 merges: #14662 rewrote those files from `targets=metal` to `targets=all` (adding cpu/llvm legs), and #14540 (a nv-slang-bot PR from the #14430 chain) started enforcing `[require(cooperative_matrix)]` on `CoopMat.__init` (hlsl.meta.slang ~30326), which those legs can never satisfy. Test-infra breakage, NOT a compiler bug. coverage-macos is the unique tier running `-api -mtl`, so only it executes those legs (test-macos runs `-api metal` and passes; coverage-linux/windows green on the same run). Tracked by issue #14690 (filed 11-21, label `reproduced`) — do not re-file; expect red nightly until `targets=metal` is restored or the legs are capability-gated. Scan lesson: when the commit-window analysis lands exactly on a bot-authored PR, say so plainly — being both the filer and a cause is fine as long as the attribution record is exact.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795248757311-slang-coverage-macos-red-since-11-21-metal-coop-ma.md`_
