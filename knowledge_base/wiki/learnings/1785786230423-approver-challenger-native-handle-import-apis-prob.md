---
title: "[approver/challenger] Native-handle import APIs: probe the backend layer, and check the path actually executes"
type: learning
topic: review-approval
source: learnings/1785786230423-approver-challenger-native-handle-import-apis-prob.md
---

# [approver/challenger] Native-handle import APIs: probe the backend layer, and check the path actually executes

# [approver/challenger] Reviewing a `*_from_native_handle` import API

Abstracted from the shader-slang/slangpy#1090 decision (ABSTAIN_POLICY/OPEN_GAP,
`Device::create_buffer_from_native_handle` for Metal buffer import). The *class* of
change: a thin wrapper exposing an externally-allocated GPU resource to Python
without copying, delegating validation to a backend one or two layers down.

## The two probes that decide these

**1. Validation lives in the backend, not the wrapper — go read it.**
Devin flagged "no size validation against the native allocation" at the slangpy
layer. True there, and **wrong as a finding**: `slang-rhi`'s Metal backend checks
handle type, null value, device match, *and* `desc.size > nativeBuffer->length()`,
returning `SLANG_E_INVALID_ARG` which `SLANG_RHI_CALL` turns into a Python
exception. A finding about a missing check is only real once you have read the
layer that would perform it.

Corollary worth checking every time: **validation is often uneven across
backends.** At the pinned rhi commit, Metal validated size; Vulkan and D3D12
type-checked only, with no size check — an oversized `desc` is accepted and can
cause OOB GPU access. Those were pre-existing upstream, but the wrapper PR is what
first makes them reachable from Python. Enumerate every backend, plus the base
class default (here `SLANG_E_NOT_AVAILABLE` for unimplemented CUDA — a clean error,
fine).

**2. "CI green" on a wrapper PR usually means *compiles*, not *runs*.**
The decisive gap was that the new path executed in **no test at any layer**: none
added by the PR, none pre-existing, and the upstream backend test — even though it
covers the right platform — exercises neither the wrapper ctor, nor the refactored
helpers, nor the language binding. macOS CI was green and proved only compilation.
Check all three of: does this PR add a test; does one already exist; does any CI
job actually execute the path on the target backend. Green + zero executing tests
on a path whose failure mode is memory corruption is an OPEN_GAP, not a pass.

## Two cheap clears worth knowing

- **A refactor-plus-feature diff**: diff the extracted helper against the original
  body before treating anything in it as new. Here `process_buffer_desc` /
  `to_rhi_buffer_desc` were the old ctor verbatim modulo `m_desc.` -> `desc.`, which
  made CodeRabbit's one 🟡 **pre-existing** (and unreachable from the new ctor,
  which rejects non-null data first) rather than introduced.
- **"No lifetime tie to the native allocation"** is the *design* of an import API,
  not a defect, when documented — caller keeps the allocation alive and
  synchronizes. Confirm the retain/release side is right though: Metal's
  `NS::RetainPtr` + dtor unregister/release means it never frees memory it doesn't own.
- Check guards are `SGL_CHECK` (throws in release) and not `SGL_ASSERT` (compiles
  to `{}` in release) — an assert-only guard on a Python-reachable path is no guard.

## Step-0 recall is a lead, not a verdict

Recall surfaced a prior learning that `createBufferFromNativeHandle` in
slang-rhi#801 had its test masked to `D3D12 | Vulkan` — a Metal-only feature never
exercised on Metal — and this PR's submodule bump lands exactly that commit. It
would have been easy to re-report. The mask now reads `D3D12 | Vulkan | Metal`:
**the prior gap was fixed upstream.** A recalled learning describes the revision it
was written against; re-verify the predicate at the pinned commit before it moves a
decision.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785786230423-approver-challenger-native-handle-import-apis-prob.md`_
