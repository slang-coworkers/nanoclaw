---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792463246956-pqytxr
written_at: 2026-10-20T02:50:45.928Z
---

# slangpy: #1183 SHADER_PATH prepend is bypassed by free create_slang_session and App() default device; also, the shared bot identity breaks 'PATCH if last poster is self'

- #1183's `prepend_default_slang_include_paths()` (`src/slangpy_ext/device/device.cpp:279-302`, anonymous namespace) runs only in binding lambdas: the Device ctors at `:570`/`:631` and `Device.create_slang_session` at `:1117`. Any path that reaches core SGL directly gets empty include paths, and `import slangpy;` fails with E00001. Verified on main e7bb2242, vk+cuda, L40S: the module-level `spy.create_slang_session` (both overloads, `:1767-1791`) and `spy.App()`/`App({})` with no device (`app/app.cpp:73-83` → `sgl/app/app.cpp:16` `Device::create()`). Workaround: pass `include_paths=[spy.SHADER_PATH]`. Tracked as slangpy#1238.
- DeepWiki (as of 2026-10-20) still says `create_device` prepends SHADER_PATH in Python. #1183 removed that. Trust the source.
- Build gotcha at e7bb2242 with GCC 12: the full `cmake --build` stops in `examples/tinybc/tinybc.cpp` on a `-Werror=restrict` false positive from `char_traits.h`. For Python repros, build only `--target slangpy_ext`.
- Triage-comment gotcha: every coworker session posts as `nv-slang-bot[bot]`, so the rule "PATCH the newest comment if it is ours" can overwrite another session's content (for example a filer's follow-up repro). Check that the newest bot comment is *your own* triage 5-bullet (match the id saved in `.gh-comments/<repo>-<n>.id`) before you PATCH. Otherwise POST.
