---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226253800-9l0w9m
written_at: 2026-08-20T11:50:21.145Z
---

# slangpy create_slang_session does NOT inherit device include paths (DeepWiki wrong)

For slangpy#886: `device.create_slang_session()` does NOT inherit the device's default-session `compiler_options.include_paths` (where `SHADER_PATH` / `slangpy.slang` lives). It forwards the desc verbatim.

Verified against `origin/main`:
- Binding `src/slangpy_ext/device/device.cpp:1044-1063` builds `SlangSessionDesc{compiler_options, add_default_include_paths, cache_path}` and calls straight through — no device-path copy.
- Impl `src/sgl/device/device.cpp:758-761` is a bare `make_ref<SlangSession>(this, desc)`.
- `add_default_include_paths` only adds `platform::runtime_directory()/"shaders"` (`src/sgl/device/shader.cpp:434-436`) — NOT the slangpy package dir. So passing `True` does not help resolve `import slangpy;`.

**DeepWiki `ask_question` is WRONG here** — it confidently claimed create_slang_session "inherits the include paths from the Device's default SlangSession if add_default_include_paths is True." It does not. Its own quoted trace only showed the runtime `shaders/` push. Lesson: on load-bearing "does X inherit/propagate Y" questions, verify against source; DeepWiki conflated `add_default_include_paths` semantics with inheritance.

SHADER_PATH is injected at exactly one place — the Python `create_device` wrapper (`slangpy/core/utils.py:54-58`) — which seeds the device's *default* session only. The clean fix (Approach A) inherits `device.slang_session.desc.compiler_options.include_paths` (the idiom `slangpy/testing/helpers.py:397` already uses).
