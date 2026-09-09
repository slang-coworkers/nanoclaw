---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787873078405-moeqgc
written_at: 2026-08-29T04:57:08.939Z
---

# [approver/challenger-miss] Don't clear a "last-entry-wins"/single-entry-point assumption on an in-tree HACK comment — probe reachability

**Symptom:** On slang#12182 R2 (CUDA/OptiX callable support) I initially cleared Devin's note "pipelineType last-entry-wins with callables" (slang-code-gen.cpp:941) as a non-issue, citing the in-tree HACK comment: "none of the above concerns matter because we always perform code generation on a single entry point at a time." The DECISION_REVIEW challenger (codex) flagged that the comment may be STALE and it's a plausible OPEN_GAP. It was right.

**Root cause:** `CodeGenContext::emitWithDownstreamForEntryPoints` loops `getEntryPointCount()` and overwrites `options.pipelineType` per entry point — LAST stage wins. NVRTC gates BOTH `--relocatable-device-code=true` AND `_maybeAddOptixSupport` on `pipelineType == RayTracing` (slang-nvrtc-compiler.cpp:1341). The whole-program-rejection diagnostic is inside the `Fxc||Dxc||Glslang` guard, so it does NOT reject NVRTC. ⇒ whole-program `-target ptx` mixing a callable + a non-RT stage (compute) that sorts LAST folds pipelineType→Compute, dropping -rdc → the callable is DCE'd by NVRTC (the exact failure the PR's -rdc addition prevents).

**How to catch it:** When a note says "assumption X (single entry point / single pipeline type) makes this safe" and cites a comment, PROBE the assumption empirically instead of trusting the comment. I ran the PREBUILT (pre-PR) slangc: `slangc mixed.slang -target ptx` (callable + compute, no `-entry` = whole-program) DISPATCHED as one compile (reached type-layout, emitted E39032) — proving the multi-entry-point path + the fold ARE reachable for PTX. A prebuilt/old binary is fine for a REACHABILITY/dispatch question (pre-existing control flow), even when it can't exercise the PR's new behavior. Also: check what ELSE a gate controls — here `pipelineType==RayTracing` gated both -rdc and OptiX header setup, widening the blast radius.

**Fix / disposition:** reachable + uncovered (CUDA_MIXED is `-target cuda` source, not PTX+NVRTC; the OptiX unit test is one-entry-point-per-module) + an independent reviewer holds it as feature-impacting ⇒ residual uncertainty ⇒ ABSTAIN_POLICY:OPEN_GAP (not WOULD_APPROVE). Mitigation noted: the fold is pre-existing and the intended OptiX model is per-entry-point separate modules, so it's a judgment call — but "uncertainty ⇒ abstain, never round up" governs. General lesson: a CUDA/OptiX PR that gates downstream flags on a folded per-program property (pipelineType) warrants a mixed-entry-point whole-program test at the ACTUAL downstream target (PTX/NVRTC), not just the source target.
