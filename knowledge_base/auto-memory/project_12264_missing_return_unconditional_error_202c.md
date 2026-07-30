---
name: project_12264_missing_return_unconditional_error_202c
description: "#12264 make missing-return unconditional error in Slang 202c — PARKED, blocked on #12179 OPEN"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7ab426f3-1d03-406a-bdc1-0d47f90c5d9e
---

# slang#12264 — missing-return → unconditional error in Slang 202c

Author **skiminki-nv** (MEMBER, human) — same author owns the prereq PR #12179.
Filed 2026-07-29. Type = `Language Maturity` (human-set). Label `reproduced` applied.

**Ask:** Today a non-void function falling off the end without `return` is an
error (E41009) only on Khronos/WebGPU (spirv/glsl/wgsl) and a warning (E41010)
elsewhere (hlsl/dxil/metal/cuda/cpp); `slangi` byte-code reports **nothing**.
Split lives in `source/slang/slang-ir-missing-return.cpp` (`doesTargetAllowMissingReturns`, line 20).
Proposal: gate severity on `module->languageVersion` instead of target — keep ≤2026
behavior unchanged, make it **unconditional E41009 on ALL targets for 202c**.
Non-breaking (only 202c-opted modules affected). Prior art: #409 (ask), #671 (shipped warning).

**Triage (2026-07-29, verified @ HEAD `1eeb3b29d`):** feature-request / language-hardening,
medium, frontend IR-validation pass + language-version semantics, **P3 (blocked on prereq)**.
Repro confirmed empirically (spirv/glsl/wgsl → E41010+E41009 exit255; hlsl/metal/cuda → E41010 exit0).
Two call sites by-design: lowering-time `slang-lower-to-ir.cpp:15675` (CodeGenTarget::None, warn→E41010);
link-time `slang-emit.cpp:1554` (real target, error→E41009). Module langver **in scope** at lowering-time call.

**Recommended path = author's Approach A:** enforce at the lowering-time call
(per-module, langver known, target-independent) → emit E41009 directly for 202c;
link-time keeps legacy behavior and must **not** double-report. Plus: slangi byte-code
coverage (open Q — currently reports nothing) + core-module audit (`hlsl.meta.slang` etc.
for existing E41010; see #10307 for a core-module fn already tripping E41009 on SPIR-V).

**BLOCKER — #12179 is an OPEN PR (not merged):** `SLANG_LANGUAGE_VERSION_202C=2027`,
`SLANG_LANGUAGE_VERSION_NEXT`, `isSlang202cOrLater()`, `-std 202c`/`next` are ENTIRELY ABSENT
from master. A #12264 fix cannot compile against master until #12179 lands.

**State:** PARK-at-triaged, **NO fixer dispatch**. Reasons: hard unmet dep (#12179 OPEN) +
author is MEMBER driving it himself (owns prereq too) + two open maintainer design forks
(slangi enforcement point; core-module 202c sequencing). Verdict posted on issue
(comment 5119296948, verify=at-HEAD).

**RESUME →** forward Approach A briefing to slang-fixer once **#12179 MERGES** AND
skiminki/a maintainer says "make a PR". Until both, watch-only.

**Memo:** triager wrote `triage-12264.md` (3-approach solution-space map, verified
file:line pointers @ HEAD, #12179 dep analysis, slangi + core-module open questions),
delivered to Main inbox via send_file.
