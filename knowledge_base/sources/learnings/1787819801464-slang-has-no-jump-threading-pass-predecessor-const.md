---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787819160640-j7aaba
written_at: 2026-08-27T08:36:41.464Z
---

# Slang has no jump-threading pass; predecessor-constant switch survives SCCP+simplifyCFG

**Context:** triaging shader-slang/slang#12792 (missed jump-threading for predecessor-constant switch selectors).

**Finding 1 — the gap is real and named.** Slang has NO jump-threading / predecessor-constant switch-threading pass. When a branch chain assigns a compile-time-constant tag per CFG path and a later `switch` consumes it (post inline+specialize+scalarize), the redundant second dispatch survives because:
- **SCCP folds a switch only on a GLOBAL constant** — `slang-ir-sccp.cpp:1376-1413`. `LatticeVal` is a single global flavor per inst (None/Constant/Any, `:39-111`); `meet()` (`:195-237`) unions two distinct constants → `Any`. A phi carrying a different constant per incoming edge collapses to `Any`, so the switch is never folded.
- **simplifyCFG does shape-based, not value-based, simplification** — `slang-ir-simplify-cfg.cpp`: `trySimplifySwitch:563`, `fuseSwitchCaseBlock:581` (redirects a case that's itself a trivial jump), `arePhiArgsEquivalentInBranches(IRSwitch*):471` (collapses a switch when all cases produce equal phi args). None correlates a phi *incoming* value with a case constant.
- **Reusable precedent for the missing walk:** `slang-ir-constexpr.cpp:578-593` already iterates `bb->getPredecessors()` and reads each `IRUnconditionalBranch`'s `getArg(paramIndex)` — the exact per-predecessor-edge shape a threading pass needs.
- **Insertion window:** `slang-emit.cpp` after SCCP+DCE (`:1811-1814`), before the post-inline `simplifyIR` at `:1818` (passes invoked via `SLANG_PASS` macro `:978`). This is "after specialize/inline/scalar-promotion, before target-specific structured-CFG legalization" (SPIR-V structurization is later, at emit via `generateRegionTreeForFunc`).

**Finding 2 — you can confirm a missed-OPTIMIZATION shape GPU-free.** Even without a GPU, a missed-opt that manifests in the IR/SPIR-V can be reproduced with a Debug `slangc`: `slangc repro.slang -target spirv-asm -entry X -O3` and `grep -c OpSwitch`. Here `splitMain` → 1 `OpSwitch` (8 cases) fed by a phi chain merging `int_0…int_7` per predecessor edge; the control `fusedMain` → 0. This proves the transform is missed at the IR level, independent of any NVIDIA downstream compiler — no need to chase the reporter's GPU-only runtime numbers. Note: a missed-opt is NOT a defect → do not apply the `reproduced` bug label; you've confirmed the *shape*, not broken behavior.

**Design caution for a fixer:** the load-bearing risk is that edge redirection must respect structured-CFG / convergence / derivative constraints — gate on same-region edges and keep the rewrite join-preserving (do NOT clone the shared continuation; the reporter already tried early continuation cloning and rejected it: CUDA 1468→3088 bytes).
