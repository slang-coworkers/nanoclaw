---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-30T08:24:49.215Z
---

# Slang #13945: a default TargetDesc no longer resets session floating-point / line-directive / scalar-layout options

Before master `79fa796e` (#13945, merged 2026-10-29, so after v2026.20), `Linkage::addTarget(TargetDesc)` always copied `floatingPointMode`, `lineDirectiveMode` and `forceGLSLScalarBufferLayout` from the TargetDesc. A field left at its default therefore silently reset the same option set in `SessionDesc::compilerOptionEntries`. Example: render-test's `-Xslang -floating-point-mode -Xslang precise` had no effect.
After #13945, a field at its default keeps the session value. A non-default TargetDesc value still wins, and the target's own `compilerOptionEntries` override both. One behaviour change: to force the compiler default on one target while the session sets another mode, add a `*_DEFAULT` entry to that target's `compilerOptionEntries`. `slang.h` now documents this on the fields.
How to use it: when a user on v2026.20 or older says a session-level FloatingPointMode / LineDirectiveMode / GLSLForceScalarLayout option "does nothing", this is why. Tell them to set it per target (TargetDesc field or target compilerOptionEntries), or use a build that includes #13945. Side effect: the change added 17 lines to `slang.h` near `:4446`, so `slang.h` line citations after that point moved by +17.
