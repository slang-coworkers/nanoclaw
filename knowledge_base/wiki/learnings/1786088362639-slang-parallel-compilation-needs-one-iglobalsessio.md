---
title: "Slang: parallel compilation needs one IGlobalSession PER THREAD — a mutex around createSession cannot work"
type: learning
topic: slang-compiler
source: learnings/1786088362639-slang-parallel-compilation-needs-one-iglobalsessio.md
---

# Slang: parallel compilation needs one IGlobalSession PER THREAD — a mutex around createSession cannot work

## The user misconception (and mine)
A user hit `STATUS_ACCESS_VIOLATION` in parallel shader compilation "even with a mutex lock on the global session". My first draft answer was **"your mutex is necessary but insufficient — also lock the objects created from it."** That is the wrong remedy: it pushes toward ever-finer-grained locking, which cannot fix this.

## Correct answer: a distinct IGlobalSession per thread
- `docs/user-guide/08-compiling.md:720-721`: *"Currently, the global session type is **not** thread-safe. Applications that wish to compile on multiple threads will need to ensure that each concurrent thread compiles with a **distinct global session**."*
- `08-compiling.md:1011` is the decisive line, because it rules out the tempting middle ground (N sessions, one shared global session): *"Front-end operations such as loading modules, type checking, specialization, and `link()` are not reentrant and require external synchronization when multiple threads share **a global session, a session, or objects created from them**."*
- `include/slang.h:4071-4074` states the same contract.

## Why a lock around createSession provably cannot help
`source/slang/slang-session.cpp:71` — `namePool = session->getNamePool();`. Every `Linkage` (= `ISession`) copies a handle to the global session's **by-value** name pool (`NamePool namePool;` at `slang-global-session.h:237`). So concurrent `loadModule`/type-checking on *separate* sessions interns names into **one unsynchronized pool**. The fault therefore surfaces **after `createSession` has returned** — you are guarding the wrong window.

Maintainer-confirmed on **#8581** (CLOSED): the reporter wrapped `createSession` in a mutex and it *"didn't help at all"*; `bmillsNV` (MEMBER): *"each session created from the global session will try to access the same data from that global session so there will be a race condition."*

Only **backend emission** is parallel-safe (`08-compiling.md:1015-1030`), and only after full specialize+link. The enabled test `parallelGenericEntryPointCompile` is **not** a precedent for the many-sessions pattern — it creates one global session *before* any thread starts and never creates sessions concurrently. Also `08-compiling.md:1034`: refcounting is not uniformly atomic across COM interfaces, so cross-thread retain/release can fault by itself.

## Bonus: there is no module-unload API, by design (hot reload)
`ISession` exposes load + enumerate only — `getLoadedModuleCount` (`slang.h:4641`), `getLoadedModule` (`:4642`). No `unload`/`remove`/`evict`/`invalidate` on `ISession` or `IModule`. It is structural: `slang-session.h:251` `List<RefPtr<LoadedModule>> loadedModulesList;` and its only `.remove()` calls are error-path rollbacks after failed semantic checking.

**#4645 CLOSED/not_planned**, `csyonghe`: *"The only way to do that is to destroy the session and reload all the modules... save the precompiled modules to disk to save reload time... slang will look for `.slang-module` files before `.slang` files."* Sessions are the reclamation unit (`slang.h:4486-4489`); recreate is cheap because the core module amortizes on the **global** session (`slang.h:4067-4069`).

Slang's hot-reload contribution is **change detection**: `IModule::getDependencyFileCount`/`getDependencyFilePath` (`slang.h:5663`/`:5666`, added by #4493 for exactly this). Known trap: an edited *imported dependency* is not auto-detected — no mtime check — so the app must poll these itself.

## Method note
When a user reports "I added the obvious lock and it still crashes", the useful question is **which window the lock covers vs. where the shared state is actually touched** — not "what else should I lock". Verify the ownership/copy site (here one line: `namePool = ...`) before proposing any synchronization advice.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786088362639-slang-parallel-compilation-needs-one-iglobalsessio.md`_
