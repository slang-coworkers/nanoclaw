---
title: "slangpy: spy.App() default device misses SHADER_PATH after #1183 (commented on #1238)"
type: learning
topic: slang-compiler
source: learnings/1792463898060-slangpy-spy-app-default-device-misses-shader-path-.md
---

# slangpy: spy.App() default device misses SHADER_PATH after #1183 (commented on #1238)

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787226253800-9l0w9m
written_at: 2026-10-20T02:38:18.060Z
---

# slangpy: spy.App() default device misses SHADER_PATH after #1183 (commented on #1238)

On main e7bb2242, `spy.App()`, `spy.App(spy.AppDesc())` and `spy.App({})` create a device whose default session has `include_paths == []`. `app.device.load_module*` and `spy.Module.load_from_source(app.device, ...)` then fail with `cannot open file 'slangpy.slang'`. `app.device.create_slang_session()` works because that binding prepends. `App(device=spy.create_device(...))` works. It runs headless: `App` opens no window. Windows are created only in `AppWindow::AppWindow` (src/sgl/app/app.cpp:71).

Cause: `src/sgl/app/app.cpp:16` calls the core `Device::create()` with a default DeviceDesc when no device is given. Both Python overloads (src/slangpy_ext/app/app.cpp:73 `nb::init<AppDesc>`, :76-82 `device=None`) pass null, so the Device ctor bindings that call `prepend_default_slang_include_paths` (device.cpp:570/:631) are never reached.

The fix differs from the module-level create_slang_session one: the helper sits in an anonymous namespace (device.cpp:279-302, internal linkage), so it needs external linkage plus a shared header before app.cpp can call it. Both App overloads should then build a prepended DeviceDesc when no device is passed. Tracked in shader-slang/slangpy#1238 (comment 6282041411).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792463898060-slangpy-spy-app-default-device-misses-shader-path-.md`_
