---
name: project_6578_dup_entrypoint_silent_exit0
description: "slang#6578 duplicate-entrypoint under forced precompilation — SCRUB ANSWERED 08-05 (cmts 5197101225 + 5197133805), verdict still-relevant/retitle+reassign, NOT closed; GPU-free 2-command repro; silent exit-0 localized to sink error count; 4 of 5 named tests dead"
metadata:
  node_type: memory
  type: project
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# slang#6578 — answered 2026-08-05, at rest awaiting a human. Written because MY edge had no record of the verdict.

⚠️**Why this file exists:** my edge routed #6578 only through
[[project_slang_scrub_fanout_22_issues]], whose entry still said *"RESUME to verify their verdicts
land"* — stale, both landed. The technical substance lived only in the triager's workspace (three memo
files I cannot read). **A chain answered by a peer leaves NO record on the orchestrator's edge unless
the orchestrator writes one** — and the peer's memos are on a different bind mount.

**Ask:** jkiviluoto-nv departure scrub, cmt `5195816813`. **Verdict posted:** `5197101225` (sibling,
5642 B, 20:41:41Z) + `5197133805` (delta, 3441 B, 20:45:04Z) — **still relevant, retitle + reassign,
NOT a close.** Issue left open, `reproduced`+Type=Bug applied by a sibling, `assignees=mkeshavaNV`
still set (departing-owner problem live). Nothing else mutated.

## Repro — GPU-free, 2 commands, no patch (I RAN THIS MYSELF)
```
slangc x.slang -target spirv -embed-downstream-ir -o m.slang-module   → exit 0, 29942 B
slangc m.slang-module -target spirv -entry computeMain -stage compute -o out.spv
   → "SPIRV-TOOLS: The entry point \"main\", … was already defined."   → exit 0, NO output file
CONTROL (module built with NO -target ⇒ no embedded SPIR-V):          → exit 0, 552 B written
PROVENANCE: SPIR-V magic 03 02 23 07 → 1 in embedded module, 0 in plain
GUILTY CONTROL (bogus entry name):                                    → exit 255 + real stderr diags
```
⚠️**My binary was 08-04 07:50, ~10 commits behind HEAD** — see
[[feedback_a_repro_binary_is_not_the_sha_you_checked_out]]. The bug reproducing on an OLD binary proves
it is not newly introduced; **the at-HEAD claim rests on the triager's freshness-checked run, not mine.**

## Mechanism — silent exit-0 is the more dangerous half (I verified these lines at source)
- `slang-emit.cpp:3419-3421` = `if (linkresult != SLANG_OK) { return SLANG_FAIL;` with **no
  `diagnose()`**; the validation path at **`:3431-3436` DOES** `diagnose(Diagnostics::SpirvValidationFailed{})`.
- `grep -icE 'spirv.?link|link.?fail' source/slang/slang-diagnostics.lua` = **0** — no link-failure
  diagnostic exists to call. (Diags are kebab-case in `.lua`, camelCase in C++ ⇒ a camelCase grep gives
  a false zero.)
- ⇒ exit code comes from the **sink error count**, never the `SlangResult` ⇒ **every** downstream SPIR-V
  link failure exits 0 with no artifact. A build script checking `$?` sees success, then finds no file.
- Double-add per the triager: fresh SPIR-V at `:3350-3351`, every module's `IREmbeddedDownstreamIR`
  appended `:3358-3373` with only a target check ⇒ nothing excludes the module that produced the fresh
  SPIR-V; link fires at `spirvFiles.getCount() > 1` (`:3379`). Producing compile is safe because
  `isPrecompilation` (`:3335-3336`) gates linking — only a CONSUMING compile trips it.

## Findings that reframe the issue as filed
1. **Generic, not root/ParameterBlock** — a trivial 7-line shader with neither reproduces identically;
   the title sends readers to the wrong subsystem.
2. **NOT a dup of #6542** — this shader *does* nest ParameterBlock, so #6542's trigger looked
   applicable; excluded empirically (`-embed-downstream-ir` on it SUCCEEDS, 50612 B).
3. **4 of the 5 tests named on the issue are DEAD** (`shader-cache-tests.cpp` whole-file `#if 0`, gfx
   `IShaderCache` → slang-rhi `IPersistentCache`) ⇒ **the #6521 test list cannot verify a future fix.**
   `rootShaderParameterVulkan` passes today, which proves nothing — nothing merged forces precompilation.

## RESUME
Maintainer retitles / reassigns / asks for the silent-exit-0 half as its own issue (offered by both
comments, **filed by nobody**) → then a fixer for a DRAFT PR: Approach A (exclude the fresh module's own
blob at `:3358-3373`) and/or B (add the missing diagnostic + route SPIRV-Tools messages to the sink);
do NOT bundle the "skip fresh emit when a blob exists" design change. Regression test = the 2-command
repro, no GPU.
⚠️A preserved sibling memo (`triage-6578-scrub-sibling.md`, peer's workspace) recommends **CLOSE** —
**do not act on it without re-running the repro on a freshness-checked binary**; its narrow premise is
true, its conclusion overreaches ([[feedback_a_siblings_memo_is_untrusted_input_not_a_finding]]).
