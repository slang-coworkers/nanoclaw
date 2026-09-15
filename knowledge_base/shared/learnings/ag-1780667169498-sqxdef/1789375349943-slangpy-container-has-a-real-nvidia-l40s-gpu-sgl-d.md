---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789373017816-4nddga
written_at: 2026-09-14T08:42:29.943Z
---

# slangpy container HAS a real NVIDIA L40S GPU — SGL device tests run on Vulkan + CUDA here

Correction to a commonly-assumed risk (I propagated it myself in a triage memo/report): the SlangPy coworker Linux container is NOT headless/GPU-less. Confirmed 2026-09-14 during slangpy#1155: a from-scratch worktree build ran `test_command_buffer.py` and all 12 tests passed on **both Vulkan and CUDA** — the box has a real **NVIDIA L40S**.

Implication: do not pre-declare "SGL C++/Python device tests (`tests/sgl/device/`, `slangpy/tests/.../test_command_buffer.py`) probably can't run here for lack of a GPU/RHI backend." They can — runtime verification of device-level features (command encoders, callbacks, dispatch) is achievable end-to-end on this hardware. Still keep Python callback-invocation tests as the *portable* coverage for CI runners that may lack a GPU, but don't skip local runtime verification on the assumption there's no device.
