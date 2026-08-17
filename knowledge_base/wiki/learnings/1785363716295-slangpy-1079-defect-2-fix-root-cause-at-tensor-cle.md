---
title: "slangpy#1079 Defect 2 fix: root-cause at Tensor::clear(), not tensor_zeros"
type: learning
topic: slang-compiler
source: learnings/1785363716295-slangpy-1079-defect-2-fix-root-cause-at-tensor-cle.md
---

# slangpy#1079 Defect 2 fix: root-cause at Tensor::clear(), not tensor_zeros

Implemented the slangpy#1079 D3D12 device-removal fix (PR #1080, draft, stacked on #1078). Key decisions, verified by source + a green VK/CUDA build:

**Fix location = SGL `Tensor::clear()` (src/sgl/func/tensor.cpp:412), NOT tensor_zeros.** The triage memo suggested guarding the clear in `tensor_zeros`, but `Tensor::clear()` is the single choke point reached by `zeros`, `zeros_like`, AND `with_grads` grad-clears. `tensor_zeros_like` forwards `other.usage()`, so `test_array_of_difftensors_read` (which builds a grad via `zeros_like(shader_resource-only)`) trips the same UAV-clear — a tensor_zeros-only patch leaves it broken. Fix at clear() covers all three.

**The fix:** when `!is_set(m_storage->desc().usage, BufferUsage::unordered_access)`, zero via a host-side zero-filled upload instead of `clear_buffer` (which D3D12 implements via a UAV op that removes the device on a non-UAV buffer). Route through the passed `cmd` via `cmd->upload_buffer_data(...)` when non-null (preserves command ordering — the public `clear(cmd)` API guarantees it); else `m_storage->set_data(zeros...)`. `upload_buffer_data` uses `copy_destination` state (no UAV) and copies the source into retained staging at record time, so a local `std::vector<uint8_t>` is safe. Do NOT add the UAV bit — it renames Tensor→RWTensor and breaks array type-resolution (full_name string compare).

**Ask #2 (usage/role mismatch → clean error) was ALREADY satisfied — do not add a guard.** `resolve_types` (tensorcommon.py:138-143) raises a clean `ResolveException` for read-only→writable BEFORE any GPU op, for BOTH scalar ("Can't pass a read-only tensor to a writable tensor") and array ("... does not match slang type RWTensor<float, 1>[4]") paths. `SlangPyError` does NOT exist in the codebase — it's only in AGENTS.md docs; the layer uses TypeError/ValueError, and resolution failures are `slangpy.core.callsignature.ResolveException`. Assert that exact type in tests, not bare Exception.

**Env/process gotchas:** (1) Fresh worktree build needs `git submodule update --init --recursive` + a venv with requirements-dev (numpy) — the `.pyi` nanobind stub-gen step imports the built package and hard-fails without numpy in the CMake-selected interpreter. (2) The critique delivery gate needs THREE named /codex-critique stages recorded (PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW) with OUTPUT_REVIEW=approve before `gh pr create` is allowed — an ad-hoc codex call doesn't count; use the codex-critique skill's verbatim prompt/developer-instructions format. (3) `send_message` MCP tool can't reach wired peers (triager/reviewer) mid-turn in this setup — use `<message to="..." in_reply_to="...">` blocks at end of turn. (4) A draft PR stacked on another draft won't surface `Fixes #N` prominently or auto-close — still post the 5-bullet on the issue itself. See [[slangpy-commit-no-ai-attribution]].

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785363716295-slangpy-1079-defect-2-fix-root-cause-at-tensor-cle.md`_
