---
name: feedback_a_return_after_diagnose_is_dead_if_the_severity_aborts
description: "A defensive `return SLANG_FAIL` placed AFTER a `diagnose()` call is unreachable when that diagnostic's severity is >= Fatal — the sink throws inside diagnose(). Measured: slang-emit.cpp:3450 is dead because spirv-validation-failed is `internal()`, while its sibling arm's identical return is live because that one is `err()`. Read the diagnostic's DECLARED SEVERITY, not the control flow."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ea332bcd-206b-4759-aa34-fd53b7063c73
---

# A `return` after `diagnose()` is dead code if that diagnostic's severity aborts

**Measured 2026-08-06 on shader-slang/slang @ `9eb90c50a`** while auditing issue #12387.

`slang-emit.cpp:3444-3451` reads as a clean convert-to-error-code:

```cpp
else if (SLANG_FAILED(validationResult))
{
    // Whether a rejected module reaches the caller must not depend on the diagnostic's
    // severity, so fail here rather than leaving it to the sink's abort.
    compiler->disassemble(spirvWords, spirvWordCount);
    codeGenContext->getSink()->diagnose(Diagnostics::SpirvValidationFailed{});
    return SLANG_FAIL;                                    // <-- UNREACHABLE
}
```

**The comment states the opposite of what the code does.** `spirv-validation-failed` is declared with
`internal(...)` (`slang-diagnostics.lua:5922-5927`), and `internal` maps to `Severity::Internal`
(`slang-rich-diagnostics.h.lua:218`; generated `slang-rich-diagnostics.cpp.fiddle:1623` confirms
`Severity::Internal`). `Internal` is the **highest** value in the enum
(`slang-diagnostic-sink.h:13-21`: `Disable, Note, Warning, Error, Fatal, Internal`), so
`diagnoseRichImpl` hits `if (effectiveSeverity >= Severity::Fatal) SLANG_ABORT_COMPILATION(msg)`
(`slang-diagnostic-sink.cpp:696-699`) → `handleSignal(SignalType::AbortCompilation)`
(`slang-signal.h:38-39`) → `throw AbortCompilationException` (`slang-signal.cpp:170`).
Control never reaches line 3450.

⭐⭐ **The sibling arm of the same `if` proves the discriminator is severity, not structure.** Ten
lines up, `SpirvValidationUnavailable` is declared with `err(...)` (`slang-diagnostics.lua:256-261`)
⇒ `Severity::Error` ⇒ `diagnose()` returns normally ⇒ its **identical** `return SLANG_FAIL`
(`:3442`) **is** live. Two arms, same shape, opposite behavior — and nothing local distinguishes them.

**No configuration rescues it.** A `-Wno-`-style override cannot lower it: `getEffectiveMessageSeverity`
refuses to lower `Error`-or-above (`slang-diagnostic-sink.cpp:744-747` — `if (effectiveSeverity <
Severity::Error || *pSeverityOverride >= effectiveSeverity)`), and `Disable` (0) is not `>= Internal`
(5). With `SLANG_HAS_EXCEPTIONS 0` (`include/slang.h:314`) `handleSignal` breakpoints and panics
instead — still no return. **Unreachable in every build configuration.**

**Why this is easy to miss:** the reviewer's eye checks *"is there a return on the failure path?"* —
and there is. The reachability of that return lives in a **different file** (a `.lua` diagnostic
declaration), behind a **two-hop mapping** (`internal` → `Severity::Internal` → `>= Fatal`), with an
enum whose highest member is not named "Fatal". The added defensive code and its own comment both
read as evidence that the case is handled.

**How to apply:**

- **Before crediting a `return`/`break`/fallthrough that follows a `diagnose()`, look up the
  diagnostic's declared severity.** `internal(...)` and `fatal(...)` in `slang-diagnostics.lua` both
  throw; `err(...)` / `warning(...)` do not. Anything after the former is dead.
- ⭐ **`Severity::Internal > Severity::Fatal`.** A `>= Fatal` test is satisfied by `Internal`, so
  "internal error" diagnostics abort. Do not read the enum as severity-ascending-to-Fatal.
- **A comment asserting behavior is not evidence of it** — here the comment claims independence from
  severity in the one arm whose severity defeats it. Treat an explicit "so that X" claim as a
  hypothesis to check, especially when it was added by the same commit as the code
  (`9cd92bb3a`, #12353, both the comment and the dead return).
- **When two arms of one conditional are structurally identical, ask what differs off-screen.** The
  asymmetry here is the cheapest possible detector and it costs one grep of the `.lua`.
- ⇒ **Fix implication:** a boundary `try`/`catch` is not the only candidate site. Reclassifying the
  diagnostic (`internal` → `err`) would make the *existing* return live. A maintainer choosing
  between the two must know the current comment is false.

Instance: [[project_12387_abort_exception_escapes_precompile_abi]]. Related:
[[feedback_slang_assert_becomes_assume_in_release_not_a_skipped_check]] (same shape: a macro's
expansion, not the call site, decides whether a check exists),
[[feedback_a_catch_site_census_must_split_convert_from_rethrow]] (the census method used on the
same issue).
