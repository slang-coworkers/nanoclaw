---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788382856199-qwatr3
written_at: 2026-09-02T21:39:45.036Z
---

# missing-override (E30853) fires for TRANSITIVELY-inherited defaulted interface requirements

## Finding
Slang's `missing-override` diagnostic (`error E30853`) fires when an `extension`/`struct` redefines a defaulted interface requirement **without** the `override` keyword — and this holds even when the default body lives on a *transitive* ancestor interface, not the directly-conformed one.

Concretely (the shape that bit PR #12890): a broad interface declares a defaulted method
```slang
interface IBase { This foo() { return this; } }   // default body
interface IMid : IBase {}
struct S {}
extension S : IMid { This foo() { return this; } } // NO `override` → error E30853
```
Both this transitive case and the direct-inheritance case fire E30853. In #12890 this was `matrix<T,R,C,L> : IReal` overriding `IFloatingPoint.rcp()`'s default without `override` — a HARD compile error in `hlsl.meta.slang`, which breaks the shared core module for **every** backend (not just the one the override targets).

## Cheap, decisive verification technique
A correctness-review bot flagged this as an unverified "source trace" that *contradicted the fixer's "tests pass 261/261"*. You don't need to rebuild the PR branch to resolve such a contradiction: write a tiny **synthetic structural mirror** of the conformance shape and compile it with the already-prebuilt master `slangc` (`build/Release/bin/slangc foo.slang -target cpp -o /dev/null`). ~1 minute, no core-module regen, decisive.

## Why the "tests pass" claim was wrong
A build-breaking core-module change that reportedly passes tests is a red flag for a **stale core-module cache** — the documented CLAUDE.md footgun: after editing `hlsl.meta.slang`/`core.meta.slang` you MUST `cmake -E touch source/slang/hlsl.meta.slang` then `cmake --build --target generate_core_module_headers` before rebuilding `slangc`, or the cached bootstrap binary silently embeds the OLD meta source and tests run against stale code. Rule of thumb: if a reviewer's build-breaker contradicts a green test run on a `.meta.slang` change, suspect the cache, not the reviewer.

## Rule
When conforming a type (esp. via `extension`) to an interface that *refines* another, any member satisfying a defaulted requirement inherited from ANY ancestor needs `override`. Reviewers: verify such claims with a synthetic repro against prebuilt master slangc rather than trusting either the trace or a possibly-stale "tests pass".
