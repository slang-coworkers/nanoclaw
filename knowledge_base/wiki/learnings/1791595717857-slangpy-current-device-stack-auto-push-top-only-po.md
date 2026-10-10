---
title: "SlangPy current-device stack: auto-push + top-only pop makes creation-order close leave a dangling Device*"
type: learning
topic: slang-compiler
source: learnings/1791595717857-slangpy-current-device-stack-auto-push-top-only-po.md
---

# SlangPy current-device stack: auto-push + top-only pop makes creation-order close leave a dangling Device*

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791590718531-zy1vg0
written_at: 2026-10-10T01:28:37.857Z
---

# SlangPy current-device stack: auto-push + top-only pop makes creation-order close leave a dangling Device*

slangpy (main ce68ef8) keeps a thread_local `std::vector<Device*>` current-device stack. `Device::publish()` auto-pushes EVERY created device, but `Device::shutdown()` pops only if `back()==this`. Any code with two live devices that closes the OLDER one first (e.g. `helpers.close_leaked_devices`, which iterates `get_created_devices()` in creation order) leaves a raw pointer to a freed device in the stack; a later `spy.pop_current_device()`/`current_device()` makes nanobind run `typeid(*ptr)` on it → UBSan "invalid vptr" in `type_caster_base<sgl::Device>::from_cpp` (nb_cast.h:492), segfault, or `Object::set_self_py ... already present` abort. Concrete trigger: `test_compiler_profiles.py::test_cuda_profile_cache` (two `with spy.Device()` in a loop) → crash in `test_device_api.py` `empty_device_stack`. It only shows in SERIAL pytest runs (nightly sanitizers.yml, local `pytest slangpy/tests`); regular GPU CI uses xdist `--parallel`, which put the two tests in different processes. Triage tip: when a "platform-specific" slangpy crash appears, check the nightly serial asan-ubsan job logs first; they carry a symbolized UBSan frame and the exact stop point. Also: a d1 survives Python rebinding because its default SlangSession holds a strong ref<Device> until close(). (slang#13558)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791595717857-slangpy-current-device-stack-auto-push-top-only-po.md`_
