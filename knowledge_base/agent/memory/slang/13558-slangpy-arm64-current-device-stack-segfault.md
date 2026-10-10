---
type: chain
title: slang#13558 — SlangPy ARM64 segfault draining the current-device stack
description: "jkwak-work, self-assigned, cross-repo slangpy CI crash in the empty_device_stack fixture (pop_current_device). Dispatched to slang-triager 2026-10-10; no fixer/PR (maintainer-owned)."
---

# slang#13558

**2026-10-10 00:0xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments,
human-filed by jkwak-work, self-assigned, milestone Q4 2026 (Fall), no labels, live body =
payload. The only session on `gh-issue-shader-slang/slang-13558` was this Main webhook session,
and no `ncl tasks` matched.

The crash happens on Linux ARM64 at `slangpy/tests/device/test_device_api.py:15`, in the
`empty_device_stack` fixture's `spy.pop_current_device()` loop, during setup of
`test_push_pop_current_device[vulkan]`. It reproduces twice at the same point, about 18% of the
way through the suite. The author's hypothesis, which they label unconfirmed: the stack holds
raw `Device*`, shutdown pops only a device that is on top, and a device lower in the stack goes
stale (documented at `device.h` ~L979 @0851599).

The code lives in **shader-slang/slangpy** (push/pop API from slangpy#960). A slangpy search for
"current_device" and "empty_device_stack" found no open issue or PR. Precedent is
[slang#13505](../imported/project_13505_slangpy_tests_cross_repo_flake_aggregate.md): same
author, self-assigned, cross-repo, so there is no fixer dispatch.

Dispatched `slang-triager` on the canonical thread (msg id 11). Asks: verify the hypothesis
against slangpy source, find the earlier test that leaves a non-top device and destroys it,
explain ARM64-only if possible, check overlap, post the 5-bullet, and report back. Open no PR.

RESUME: triager report, a jkwak reply or "please make a PR" (webhook), or a slangpy PR that
references #13558.

**10-10 01:28Z: triage report** (memo inbox `a2a-1791595685098-ukig0y/triage-13558.md`). Comment
[6092160118](https://github.com/shader-slang/slang/issues/13558#issuecomment-6092160118) is live.
Main checked it: nv-slang-bot[bot], 7062 chars, the issue now has 1 comment, still open, assigned to jkwak. Triager's call: medium / P2, a slangpy
library lifetime bug that a test exposed. **It's not a compiler bug.**
- **Mechanism: Main verified it at slangpy ce68ef8.** `device.cpp:52` is a thread_local `vector<Device*>`.
  `publish()` auto-pushes every new device (:433-445). `shutdown()` pops only when `back()==this`. `pop_current_device()` returns the raw back().
- **Trigger** (triager's finding): `test_compiler_profiles.py::test_cuda_profile_cache[cuda]` (slangpy#1199, 10-08).
  It opens two `with spy.Device` blocks in a loop (Main confirmed the loop at :263-276). Then `close_leaked_devices` closes them in
  creation order, so d1 stays on the stack after it is freed.
- ⭐ **Not specific to ARM64: Main verified this in the logs.** slangpy nightly `sanitizers` run 37882961924 @ce68ef8, job
  113666584111 (linux x86_64 asan-ubsan): test_cuda_profile_cache PASSED at 04:28:16Z, then at
  test_push_pop_current_device[vulkan] UBSan reports `nb_cast.h:492:51 … not an object of type 'sgl::Device'` / `invalid vptr`
  at 04:29:51Z. The Windows asan job 113666584159 also failed. Regular GPU CI runs `--parallel`, so the two tests land on
  different workers. That parallel claim is the triager's, and Main didn't check it.
- Fix options, for the maintainer to pick: A, `shutdown()` erases every occurrence (changes the
  test_device_api.py:246-261 expectation); B, strong `ref<>` entries; C, a test-only fix (masks the bug). Nothing has been dispatched.

**HELD** on the jkwak-work fix decision. Re-chase `rechase-13558-device-sta-f70c` fires 2026-10-14T16:00Z.
