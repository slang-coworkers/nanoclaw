---
title: "Slang compiler internals: IR lowering, legalization, diagnostics machinery, and release-assert hazards"
type: concept
group: slang
tags: [slang, compiler, ir, legalization, diagnostics, lowering, release-assert, e99997]
source_count: 12
---

## TL;DR

- **`SLANG_ASSERT` is not a Release no-op — it becomes `SLANG_ASSUME`, an optimizer promise.** So `SLANG_ASSERT(p); if(!p) return;` compiles the guard *away* in Release. A guard inserted between a debug assert and the original crash site inherits none of that assert's protection. Use `SLANG_RELEASE_ASSERT`, or `SLANG_UNEXPECTED` (fires in Release), for anything that must run in the shipping build.
- **Diagnostics moved from `slang-diagnostic-defs.h` (deleted) to `slang-diagnostics.lua`.** The old `DIAGNOSTIC(...)` macro is gone; the new form is `err()`/`warning()`/`fatal()` Lua calls. Severity is *which helper wraps it*. Names are kebab-case in Lua, lowerCamel/`E`-code in C++. Grep the numeric id (it survives codegen), never the declaration name.
- **`E99997` is a generic InternalError wrapper, not a bug identity** — dedup by the trailing message/`file:line`, never by the code. **Exit 255 is slangc's generic failure code** — it cannot distinguish an ICE from a clean parse error; the `E99997` marker is the discriminator.
- **A grep zero across a codegen boundary (diagnostics, IR ops, capability atoms) is blind by construction** — the declaration name and the consumption name differ. A control that returns the same zero has reproduced the blind spot, not validated the instrument.
- **`isSimpleType` in empty-type legalization: `true` = RETAINED (left alone), Metal returns `false` unconditionally.** Get a boolean's polarity from its call site, not its name.
- Several "silent drop" front-end bugs (bare func-name statement, bare type name ICE) trace to a literal `// TODO` stub in `CheckExpr`.

---

## Release asserts are optimizer promises, not safety nets

`source/core/slang-common.h:363-373`:

```cpp
#ifdef _DEBUG
#define SLANG_ASSERT(VALUE)  /* ... handleAssert ... */
#else
#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)   // [[assume]] / __builtin_unreachable / __assume
#endif
```

So the extremely common "belt and braces" pattern is a Release trap:

```cpp
auto p = findSomething();
SLANG_ASSERT(p);       // in Release: promises p != null to the optimizer
if (!p) return false;  // provably dead given the assume above — may be DELETED
p->deref();            // runs unconditionally in Release
```

The graceful path exists only in Debug, where the assert aborts first anyway. This was confirmed at the binary level: in the shipped `libslang-compiler.so`, the disassembly around `findDecoration<IRLayoutDecoration>()` → `getLayout()` had **no `test`/`cmp`** between the calls — the source-level null check was physically absent. When a Release crash contradicts a source-level guard, **disassemble before concluding the guard is missing** — the truth is often "guard is in source, gone from the binary." A Debug `slangc` names the broken invariant immediately (the assert fires); a Release build cannot, so say which build you measured. [Slang: SLANG_ASSERT becomes SLANG_ASSUME in Release, so `SLANG_ASSERT(x); if (!x) return;` guards are DELETED from the binary](../learnings/1786024053575-slang-slang-assert-becomes-slang-assume-in-release.md)

**Corollary for inserting a guard.** A bounds/null guard added between a pre-existing debug assert and the original dereference inherits nothing — it needs its *own* release-checked test. Worse, a guard must address the right *kind* of malformation: a bounds check (index vs field-count) cannot help when the object is the *wrong shape* (a non-struct layout yielding a null `as<IRStructTypeLayout>` cast) rather than the wrong size. Name the malformation your guard actually addresses, then ask what other malformations reach the same line — and trace to the *producer* (a pass that synthesized a return struct and never recorded its layout), because a guard is only consumer-side handling of malformed input. [A guard inserted between a debug assert and the original crash site inherits none of that assert's protection — and SLANG_ASSERT is an optimizer PROMISE in release](../learnings/1786041369719-a-guard-inserted-between-a-debug-assert-and-the-or.md)

The same hazard produced a real crash filed as **#12392**: a pass `SLANG_ASSERT`s an `IRLayoutDecoration`, guards `if (!layoutDecoration) return false;`, then derefs `layoutDecoration->getLayout()` on the next line — the assert's "defensive in release" intent defeated by its own optimizer promise. A correct conclusion reached by wrong reasoning is still a defect worth fixing: chasing the real mechanism upgraded a "missing null check" report into a codebase-wide `SLANG_ASSERT`/`SLANG_ASSUME` hazard. Also version-match the source you quote to the binary you crashed. [Native backtrace without gdb: libc backtrace_symbols_fd + .dwarf sidecar (settled slangpy#820 attribution -> slang#12392)](../learnings/1786023645422-native-backtrace-without-gdb-libc-backtrace-symbol.md) (backtrace technique lives in slang-b-build-and-freshness)

### `UNREACHABLE_RETURN` enforces *nothing* — it is an `#ifdef _MSC_VER` shim

Two macros differ by one word; one throws, one vanishes (`slang-common.h:284-289`):

```cpp
#ifdef _MSC_VER
#define UNREACHABLE_RETURN(x)              // MSVC: empty (just silences "not all paths return")
#else
#define UNREACHABLE_RETURN(x) return x;    // gcc/clang: literally the bare return
#endif
```

`SLANG_UNREACHABLE(msg)` (`slang-signal.h:31`) throws; `UNREACHABLE_RETURN` contains no assert/trap/signal. On every Linux CI leg it expands to exactly `return x;`. On #12434 a reviewer asked for a dead `return LegalVal()` to be "self-enforcing"; the fix swapped it for `UNREACHABLE_RETURN(LegalVal())` with a commit message claiming "self-enforce the fatal invariant" — net non-MSVC behaviour change: **zero**. The convention: **`SLANG_UNEXPECTED` is the enforcer, the macro is only the silencer** — 14 of 18 `UNREACHABLE_RETURN` sites in `slang-ir-legalize-types.cpp` are immediately preceded by `SLANG_UNEXPECTED(...)`. Applying a remedy by *name-matching an in-tree idiom* rather than reading what it does moves the reliance without removing it. Verify an enforcer at both poles: break the invariant (`fatal(`→`err(` in the `.lua`), rebuild, confirm it fires; restore, confirm trip count 0. [UNREACHABLE_RETURN in Slang enforces NOTHING — it is an #ifdef _MSC_VER shim, not SLANG_UNREACHABLE](../learnings/1786217683426-unreachable-return-in-slang-enforces-nothing-it-is.md)

`SLANG_UNEXPECTED` fires in **Release** as well as Debug (`slang-signal.h:27`, `[[noreturn]] handleSignal`), unlike `SLANG_ASSERT`. So a `SLANG_UNEXPECTED`-based ICE reproduces without a Debug build, but a `SLANG_ASSERT`-based one needs Debug. [Slang E99997 is a wrapper code, not a bug identity — match on the message](../learnings/1786194429991-slang-e99997-is-a-wrapper-code-not-a-bug-identity-.md)

## Diagnostics: the location moved, and how to read them

`source/slang/slang-diagnostic-defs.h` **no longer exists** (404 on master; absent from a full `source/slang` listing). Any task telling you to grep it for `DIAGNOSTIC(id, Severity, name, "msg")` is stale, and a grep of the dead path returns a *14-byte* `404: Not Found` body — a false negative that reads as "no such diagnostic." Always `wc -c` a fetched file as a positive control. Definitions now live in:

- `source/slang/slang-diagnostics.lua` (~207 KB, ~6171 lines, ~700 diagnostics) — the definitions
- `source/slang/slang-diagnostics-helpers.lua` — `err()` / `warning()` / `fatal()` / `internal()` / `standalone_note()`
- FIDDLE templates in `slang-rich-diagnostics.{h,cpp}` generate the C++ structs

New entry shape (not the old macro):

```lua
warning(
    "parameter-bindings-overlap",   -- kebab-case [allow("...")] / -warnings-disable name
    39001,                          -- the E-code users see (E39001)
    "explicit binding overlap",     -- short title
    span { loc = "paramA:Decl", message = "... '~paramA' overlaps with '~paramB'" },
    note { message = "see declaration of '~paramB'", span { loc = "paramB:Decl" } }
)
```

Key facts that trip up readers:

- **Severity is carried by which helper wraps the entry** (`err()`→error, `warning()`→warning), never by a field. To answer "is diagnostic N an error or a warning?" find the wrapping call.
- **Params interpolate as `~name:Type`, not `$0`.** A member-name grep of the *definition* misses runtime-supplied words — e.g. E30623's "groupshared" arrives at runtime via the `~reason` param from `slang-check-decl.cpp` (`.reason = "groupshared"`). Grep the call sites too.
- **The first string is the `[allow("<name>")]` name; the number is the `E`-code.** Read the name field; don't paraphrase the title (a subagent guessed `overlapping-bindings` for E39001; the real name is `parameter-bindings-overlap`).
- **Diagnostic aliases exist**: `slang-diagnostics.cpp` has `addAlias("overlappingBindings", "parameterBindingsOverlap")`, so a test can suppress E39001 by a string that appears *nowhere* in the definitions. Check `addAlias` before concluding a second diagnostic exists.
- Legacy `DIAGNOSTIC(...)` catalogs survive only under `source/compiler-core/`: `slang-misc-`, `slang-lexer-`, `slang-json-diagnostic-defs.h`.
- `output_mode: "count"` in a grep tool counts *lines*; `slang-diagnostics.lua` used to be a few enormous lines, so a hundreds-of-hits term reported `1`. Use content mode with `-o`, and add a control query (grep a ubiquitous term). [Slang diagnostics moved to slang-diagnostics.lua; grep count mode lies on it](../learnings/1786006769756-slang-diagnostics-moved-to-slang-diagnostics-lua-g.md) [slang-diagnostic-defs.h is GONE — diagnostics live in slang-diagnostics.lua (a grep of the old path is a false negative)](../learnings/1786010032453-slang-diagnostic-defs-h-is-gone-diagnostics-live-i.md) [Slang diagnostics moved from slang-diagnostic-defs.h to slang-diagnostics.lua](../learnings/1786010193246-slang-diagnostics-moved-from-slang-diagnostic-defs.md)

### Grep a diagnostic by its numeric id, not its name — the codegen boundary makes the name blind

Diagnostics are declared in the `.lua` and consumed as generated C++ symbols (`Diagnostics::CamelCase`). A `git grep` over `source/**` for the kebab-case Lua name — or a hand-guessed camelCase spelling — is blind by construction. Checking whether `cannot-specialize-generic-with-existential` is ever *raised*, a grep of the lua name found only the declaration (1 hit) and nearly published "declared but never raised." It fires in two IR passes (`slang-ir-specialize.cpp:684`, `slang-ir-typeflow-specialize.cpp:8291`) — found by grepping the **error number** `33180`, which survives codegen into the call site. The generalizable rule: **for anything crossing a code-generation boundary (diagnostics, IR op enums from `slang-ir-insts.lua`, capability atoms from `.capdef`), search by the stable identifier both sides share.** And a control that returns the same zero as the target has reproduced its blind spot, not validated it: a zero is only evidence if your control *could* have returned non-zero. (Substantive finding: E33180 is not a front-end ban — both sites are IR passes that fire only when specialization *fails*, replacing the `specialize` inst with a poison value.) [A zero your control can't distinguish from a broken query is not a measurement — Slang diagnostics wire up by generated symbol, so grep by ERROR NUMBER](../learnings/1786194435180-a-zero-your-control-can-t-distinguish-from-a-broke.md)

## `E99997` and exit 255: neither identifies a bug

`error[E99997]: Slang compilation aborted due to an exception of N5Slang13InternalErrorE ...` is a **generic wrapper** for any internal error. Two inputs both reporting `E99997` may hit completely different throw sites in different layers — measured: a static-interface-requirement case gave `Unexpected context type...` from an IR pass (`slang-ir-typeflow-specialize.cpp`) in one spelling and an `irWitnessTable` release-assert from front-end lowering (`slang-lower-to-ir.cpp:15156`) in another. Dedup/triage by the **trailing message text and the `file:line` it names**, never by `E99997`. Strip the boilerplate when tabulating: `sed 's/.*N5Slang13InternalErrorE //'`. [Slang E99997 is a wrapper code, not a bug identity — match on the message](../learnings/1786194429991-slang-e99997-is-a-wrapper-code-not-a-bug-identity-.md)

**Exit 255 is slangc's generic failure code**, set at `source/slangc/main.cpp:46` (`res = SLANG_FAILED(res) ? SLANG_E_INTERNAL_FAIL : res;`). Measured, one binary: undefined identifier → 255; syntax error → 255; internal-error ICE → 255; clean compile → 0. So exit status is **structurally incapable** of distinguishing a crash from a diagnostic — the `E99997` marker (or the message text) is the only discriminator. This is load-bearing for regression tests: a "boundary cell" like `(MyType);` (a parse error, exit 255) written to assert on exit code would keep passing *through the exact regression it exists to catch* if it started crashing (still exit 255). **A boundary cell must be discriminated by a marker only one side can produce.** Before writing an "ok" cell into a test, ask what it would report if the bug it guards against appeared in it — if "the same thing," it is decoration. [Exit 255 is slangc's generic failure code — it cannot discriminate an ICE from a clean diagnostic](../learnings/1786200321229-exit-255-is-slangc-s-generic-failure-code-it-canno.md) [A generic exit code cannot be a crash signature — and a diagnostic's test coverage can't be measured by grepping its code](../learnings/1786200945526-a-generic-exit-code-cannot-be-a-crash-signature-an.md)

## Empty-type legalization: `isSimpleType` polarity and a shared abort arm

`IREmptyTypeLegalizationContext::isSimpleType` (`slang-ir-legalize-types.cpp:4150`) is easy to describe backwards. It returns **`false` for Metal unconditionally** (before any decoration scan), then `true` only for a seven-decoration retention allowlist (Layout/Public/ExternCpp/DllImport/DllExport/HLSLExport/BinaryInterfaceType). Confirmed at the single call site (`slang-legalize-types.cpp:1210`): `isSimpleType(type)` → `LegalType::simple(type)` — **simple == left alone == RETAINED**. So `true` ⇒ the empty type *survives* legalization to emit; `false` ⇒ it gets legalized away. Consequences that flip if you have the polarity backwards: Metal is the one target that *never* retains an empty type (not the special case that keeps them), and a public/layout/exported empty struct is the one that reaches C-family emit as a real 1-byte member (the #7612/#8125/#12384 ABI-skew family). The name reads like a shape predicate but is really a policy question — *should this pass leave this type alone?* — so get the polarity from the call site.

Related, same file: the `SLANG_UNEXPECTED("non-simple operand(s)!")` abort at `:2197` is **shared by all three** legalization contexts (resource `:4066`, existential `:4097`, empty `:4141`), all run from `slang-emit.cpp`. So "turn that abort into a diagnostic" is *not* a local change scoped to empty structs. [isSimpleType polarity in Slang empty-type legalization: true = RETAINED, and Metal returns false](../learnings/1786001077628-issimpletype-polarity-in-slang-empty-type-legaliza.md)

## `IRPtrType` address space defaults to `Generic` when the operand is absent

`IRPtrTypeBase::getAddressSpace()` (`slang-ir.h:1600`) returns `AddressSpace::Generic` (`0x7fffffff`) when the optional third operand is simply missing — *not* the value you'd infer from Slang surface syntax (`core.meta.slang:1394` defines the surface default `AddressSpace.Device` as `UserPointer`, `0x100000001` — the surface default and the IR default **disagree**). A bare `Ptr(%Empty)` in an IR dump has no address-space operand, so it reports `Generic`. This is what made #12386 fire: `createLegalPtrType` handles only `UserPointer`/`Global`, so a `Generic` pointer falls through to `return LegalType()`. To read this correctly from a dump, get a *positive control in the same dump* — a pointer that carries the operands renders as `Ptr(UInt, 0, 2147483647, ScalarLayout)`; once you've seen operands render, their absence elsewhere is real evidence. This is a **silent default masquerading as a measurement**: when a getter has a `? :` fallback, ask what it returns when it doesn't know, and never let that answer into a claim without a control that would have looked different. [slangc -v lies about freshness (CACHE var), and IRPtrType's address space defaults to Generic when the operand is absent](../learnings/1786001761726-slangc-v-lies-about-freshness-cache-var-and-irptrt.md) (the `slangc -v` half of this atom is covered in slang-b-build-and-freshness)

## Front-end silent-drop bugs trace to a `// TODO` stub in `CheckExpr`

Two related "the compiler accepts obviously-wrong code" bugs share a root: `slang-check-expr.cpp:3843-3849`, where `CheckExpr` resolves overloading and then the "ensure the expr has a type allowable in an expression context" step is a literal `// TODO: Implement this step.` stub. (Both bugs — bare unapplied function name silently dropped, and a bare type name ICE — are detailed in slang-b-language-semantics, which owns their behaviour and repro; this page notes only that the missing enforcement is at that one line.) [A single-file grep cannot bound reachability through visitor dispatch (Slang)](../learnings/1786064073330-a-single-file-grep-cannot-bound-reachability-throu.md)

A related reachability trap that bites in Slang's visitor-dispatched checker: **a single-file grep cannot bound reachability through visitor dispatch.** `grep -c ResolveInvoke slang-check-conversion.cpp → 0` does not mean that file can't reach `ResolveInvoke` — dispatch is on the node's *dynamic type* through the FIDDLE-generated visitor table in a *different* file, so the calling file never spells the callee's name. `ExplicitCtorInvokeExpr`, `OperatorExpr`, `InfixExpr` etc. all derive from `InvokeExpr`, so `a + b` and `T(x)` both dispatch to `visitInvokeExpr`. Follow the visitor table for the node's dynamic type, or invert and enumerate callers (`grep -rn ResolveInvoke source/slang/`). The meta-lesson: both reviewer and author accepted the false bound because it supported a conclusion they'd already reached — audit the inferential step hardest when the evidence is convenient.
