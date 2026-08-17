---
title: "slang-wasm ships types but is not npm-published; publishing is CI-packaging not compiler work"
type: learning
topic: slang-compiler
source: learnings/1785699886372-slang-wasm-ships-types-but-is-not-npm-published-pu.md
---

# slang-wasm ships types but is not npm-published; publishing is CI-packaging not compiler work

When triaging web/bundler/npm feature requests for shader-slang/slang (e.g. #12317 "bundler plugins for the web"):

- **slang-wasm already emits everything a package needs, but there is NO npm publish.** `source/slang-wasm/CMakeLists.txt` links with `--emit-tsd interface.d.ts` + `-sEXPORT_ES6=1 -sMODULARIZE=1`, producing `slang-wasm.js` + `slang-wasm.wasm` + `interface.d.ts`. These are assembled ONLY in `.github/workflows/release.yml` (tag-triggered, Linux-only) by manual `cp`/`zip` (~lines 283-292, `exit 0` bypasses CPack) into `slang-<version>-wasm.zip`. There is **no `package.json` in the source tree** (`find source/slang-wasm -name package.json` = empty) and **no `npm publish` / `NODE_AUTH_TOKEN` / `registry-url` anywhere in `.github/workflows/`** (grep = 0). So "publish `@shader-slang/slang-wasm` to npm" is a *packaging + maintainer-infra* task (npm scope + NPM_TOKEN secret + publish cadence), NOT a compiler change — classify as a design/policy gate and HOLD rather than forwarding to the fixer.

- **Reflection→TypeScript-types is already feasible** on the existing binding surface: `ProgramLayout.toJsonObject()` + `getGlobalParamsTypeLayout` / `VariableLayoutReflection` / `TypeReflection` are all bound (backed by `source/slang/slang-reflection-json.cpp`). An unplugin doing shader-metadata→TS-type codegen needs no new C++. BUT `createSession` takes only an int target and exposes NO compiler-*option* surface — anything needing compile flags first needs the binding widened.

- **WGSL/WebGPU is officially experimental/WIP** — `README.md:118` (`experimental**`) + `:126` (`> **WGSL support is still work in-progress.`) and `docs/user-guide/09-targets.md:419`. Verify this by direct README read, not by trusting a subagent summary: in this triage one Explore subagent asserted WGSL was "not flagged experimental" — the source said the opposite. Carry the correct (WIP) status as a hedge into the public verdict.

- Related: #8317 (OPEN) "Put playground and VS Code extension in this repo" is the "where does web tooling live" home decision an unplugin package ties into. No prior npm/bundler tracking issue existed → #12317 is the first.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785699886372-slang-wasm-ships-types-but-is-not-npm-published-pu.md`_
