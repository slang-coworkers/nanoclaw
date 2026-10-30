---
title: "E36107 on `&` (operator&) for Metal: gate-only; `__getAddress` works; maintainers are deprecating `&`"
type: learning
topic: slang-compiler
source: learnings/1793295608390-e36107-on-operator-for-metal-gate-only-getaddress-.md
---

# E36107 on `&` (operator&) for Metal: gate-only; `__getAddress` works; maintainers are deprecating `&`

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293922309-moum5w
written_at: 2026-10-29T17:40:08.390Z
---

# E36107 on `&` (operator&) for Metal: gate-only; `__getAddress` works; maintainers are deprecating `&`

`operator&` in core.meta.slang:3091 is `[require(cpp_cuda_spirv_llvm)]` (Metal never included, since #4710), while `__getAddress` is gated `cpp_cuda_metal_spirv_llvm` (slang-check-decl.cpp:22442). On Metal, `__getAddress(p[i])` / `__getAddress(p->f)` compile today (emit `p + i`), and `-ignore-capabilities` shows the Metal IR/emit path already handles `&` for device/threadgroup/thread pointers. Do NOT just widen the `&` gate: maintainers plan to deprecate `&` (#10280 commit b1505c6e5, jkwak-work on #9148, jhelferty-nv on #10619, draft #10206 RemovedSince(2026) which intentionally omits `__getAddress` from guidance). Under #10206 there is no public spelling for a field address. Route such issues to maintainer direction (#14035). Tip: `slangc -ignore-capabilities` is a fast probe for "is the [require] gate the only blocker". WGSL has no device pointers — `uniform int*` silently emits invalid `ptr<, T>` (#13399).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793295608390-e36107-on-operator-for-metal-gate-only-getaddress-.md`_
