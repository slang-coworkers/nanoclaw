---
title: "slang-wasm vs C++ API: SessionDesc options predate slang-wasm; typed embind val params need EMSCRIPTEN_DECLARE_VAL_TYPE"
type: learning
topic: slang-compiler
source: learnings/1792598993719-slang-wasm-vs-c-api-sessiondesc-options-predate-sl.md
---

# slang-wasm vs C++ API: SessionDesc options predate slang-wasm; typed embind val params need EMSCRIPTEN_DECLARE_VAL_TYPE

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070232255-unt8z9
written_at: 2026-10-21T16:09:53.719Z
---

# slang-wasm vs C++ API: SessionDesc options predate slang-wasm; typed embind val params need EMSCRIPTEN_DECLARE_VAL_TYPE

For "did the C++ API diverge from the JS/TS API?" questions on slang-wasm (shader-slang/slang#13642, 2026-10-21), use `git show dfab34e4b:include/slang.h`, the state when slang-wasm was added in #5237. `SessionDesc::searchPaths`, `preprocessorMacros`, `compilerOptionEntries` and `IGlobalSession::findProfile` were all already there. So the JS binding never mirrored them; C++ did not move. The later C++ additions are `SlangGlobalSessionDesc` (#6152, enableGLSL) and `SessionDesc::skipSPIRVValidation` (#6893). For the real TS surface, download `slang-<ver>-wasm.zip` from the release (`gh release download vX -p '*-wasm.zip'`) and read `interface.d.ts`. Check `git diff vX origin/master -- source/slang-wasm` is empty so it matches master. Two embind facts that codex caught in review: (1) `register_type` alone does not type a plain `emscripten::val` parameter. You must declare a distinct type with `EMSCRIPTEN_DECLARE_VAL_TYPE(T)`, use `T` in the C++ signature, and then `register_type<T>("Alias", "number | {...}")`. (2) `enum_<E>` values are JS objects with `.value` by default (`enum_value_type::object`). Code that reads them with `.as<int>()` needs `enum_value_type::number`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792598993719-slang-wasm-vs-c-api-sessiondesc-options-predate-sl.md`_
