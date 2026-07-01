---
title: "Adding a method to Slang IGlobalSession — the 4 ABI touchpoints beyond header+impl (replay-handlers is the silent one)"
type: learning
topic: slang-compiler
source: learnings/1781177934466-adding-a-method-to-slang-iglobalsession-the-4-abi-.md
---

# Adding a method to Slang IGlobalSession — the 4 ABI touchpoints beyond header+impl (replay-handlers is the silent one)

When appending a virtual to a recorded COM interface in shader-slang/slang (verified for `IGlobalSession`, PR #11556 / issue #11552, master d92b15e02), the header declaration + the concrete `Session` impl are NOT enough. Four more coordinated edits are required, and only three are compile-enforced:

1. **`include/slang.h`** — append the pure virtual *immediately before the closing `};`* of the interface (after the current last method). Mid-interface insertion shifts every later vtable slot → silent ABI break. (compile-safe by itself, but ABI-correctness is on you.)
2. **`source/slang/slang-global-session.h` + `.cpp`** — declare + implement the `Session` override. **Compile-enforced** (abstract class otherwise).
3. **`source/slang-record-replay/proxy/proxy-global-session.h`** — add the `GlobalSessionProxy` override. **Compile-enforced** (it implements the interface). Forward + record; for scalar `T*` out-params use `PREPARE_POINTER_OUTPUT(arg)` (redirects null → stack temp, making the later record null-safe) then `RECORD_OUTPUT(arg)` (derefs `*arg`). Do NOT stub with `REPLAY_UNIMPLEMENTED_X` for a query — it breaks the API for record/replay users. Pattern refs: `getCompilerElapsedTime` (out-params), `proxy-session.h` `getTypeConformanceWitnessSequentialID` (RECORD_OUTPUT).
4. **`source/slang-record-replay/replay-handlers.cpp`** — add `REPLAY_REGISTER(GlobalSessionProxy, <method>)` to the registration list (next to the previously-last method). **NOT compile-enforced** — a missing registration only fails at *replay dispatch* of a recorded stream, so this is the one silently forgotten. Every recorded `IGlobalSession` method has a `REPLAY_REGISTER` entry; match that.
5. **`tools/slang-unit-test/unit-test-vtable-stability.cpp`** — the `IGlobalSessionProbe` mock must implement the new method (**compile-enforced** — pure virtual) as the next `lastSlot = N`; also add `callSlot(&p, N); SLANG_CHECK(p.lastSlot == N);` to the `vtable<Interface>` test (proves the new method is the LAST slot = truly appended, the ABI guard) and bump the section comment `(own slots 3-(N-1))` → `(3-N)`.

Other in-tree references to `IGlobalSession` (slang-wasm, render-test, gfx, slangi-tool) only *hold a pointer* — no override needed. Grep `: public (slang::)?IGlobalSession` / `ProxyBase<slang::IGlobalSession>` / `: IGlobalSession` to enumerate true implementers (were exactly: `Session`, `GlobalSessionProxy`, `IGlobalSessionProbe`).

Why this matters: the build catches #2/#3/#5-probe, so they're self-correcting; #1 (slot placement) and #4 (replay registration) are NOT, and a triage memo that estimates "2 edits (header + impl)" badly undercounts. codex CODE_REVIEW caught the missing #4 here. A correctness-focused reviewer or codex pass specifically checking record-replay registration + vtable-slot append is worth it for any IGlobalSession addition.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781177934466-adding-a-method-to-slang-iglobalsession-the-4-abi-.md`_
