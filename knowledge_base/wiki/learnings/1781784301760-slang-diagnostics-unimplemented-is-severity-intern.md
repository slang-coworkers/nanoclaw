---
title: "Slang Diagnostics::Unimplemented is Severity::Internal — aborts compilation, wrong channel for user-actionable errors"
type: learning
topic: slang-compiler
source: learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md
---

# Slang Diagnostics::Unimplemented is Severity::Internal — aborts compilation, wrong channel for user-actionable errors

When reviewing or writing Slang compiler diagnostics, do NOT use `Diagnostics::Unimplemented` for a user-correctable limitation.

**Why:** `Unimplemented` is defined as `internal("unimplemented", 99999, ...)` in `slang-diagnostics.lua` (~5523). `Severity::Internal` is numerically `5`, which is **greater than** `Severity::Fatal (4)` (see `slang-diagnostic-sink.h`), so `diagnoseRichImpl` runs `SLANG_ABORT_COMPILATION` (`slang-diagnostic-sink.cpp:696`). Its rendered template is *"internal error: unimplemented feature in Slang compiler: <feature>\nFor assistance, file an issue on GitHub..."* — i.e. it tells the user they hit a compiler bug. If you then stuff user-remediation advice into the `.feature` field (e.g. "mark the function [ForceInline]"), the message is self-contradictory ("file a bug" + "fix your code this way") and the multi-sentence text reads awkwardly in a slot meant for a noun-phrase feature name.

**How to apply:** For a genuine user-facing limitation with a workaround, add a dedicated `err`-severity diagnostic with a stable error code (like the sibling `E55201` "recursion not allowed"). For a genuine internal invariant that upstream checks guarantee can't happen, use `SLANG_ASSERT`/`SLANG_UNEXPECTED` instead of a live `sink->diagnose(...)`. Surfaced on shader-slang/slang#11660 (OptiX nested-terminate fix); both the correctness reviewer and the clarity reviewer independently flagged it as the top issue. Note `slang-ir-legalize-varying-params.cpp:1046,1057` already use `Unimplemented` for terse target-limitation statements — that local precedent is fine because those are short noun-phrases, not "file an issue"-contradicting remediation paragraphs.

**Bonus (review-process):** `checkForRecursiveFunctions` (the E55201 source) runs only under `shouldRunNonEssentialValidation()` — so "recursion is rejected upstream" is NOT an airtight invariant; with non-essential validation disabled, recursive call chains reach later IR passes. Don't accept "rejected upstream by E55201" as a guarantee without checking it isn't gated behind non-essential validation.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781784301760-slang-diagnostics-unimplemented-is-severity-intern.md`_
