---
name: project_8681_debuginfo_strip_spiropt
description: "#8681 refactor: replace Slang's stripDbgSpirvFromArtifact with spirv-opt — TRIAGE-AND-PARK, jkwak self-filed"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0b9176cc-c41a-4b13-9de3-935d7c41b5da
---

shader-slang/slang **#8681** — maintainer refactor proposal (jkwak-work, self-filed + self-assigned, Type=Refactoring, P3/low). Replace Slang's hand-rolled SPIR-V debug-strip (`stripDbgSpirvFromArtifact`, slang-emit.cpp:2980) with spirv-opt's `--strip-debug`/`--strip-nonsemantic` via a new slang-glslang export.

**LOAD-BEARING FINDING (verified by code trace at HEAD d8e8e1a9e):** jkwak's stated premise — "we add the DBI AFTER stripping so it shouldn't be affected" — is INCORRECT. The DebugBuildIdentifier (DBI = hash linking stripped main module ↔ .dbg.spv) is emitted BEFORE the strip; nothing re-adds it. Both spirv-opt strip passes (`CreateStripDebugInfoPass`, `CreateStripNonSemanticInfoPass`) would DELETE the DBI + its OpString + the NonSemantic import. So the literal ask ("delete Slang code, just call spirv-opt") is UNSAFE — fails regression test `tests/spirv/separate-debug.slang`. Any correct fix MUST keep a small DBI-preservation step.

**Approaches:** C (recommended — thin ~15-line DBI shim, spirv-opt owns the bulk allow-list), fallback A (delegate + re-inject DBI), B (just harden the existing hand-rolled walker, no refactor). Prior attempt: Copilot PR #8682 (CLOSED) — jkwak wants it redone with a newer LLM.

**Routing:** TRIAGE-AND-PARK per `feedback_no_autofixer_jkwak_self_filed` — self-filed + self-assigned → NO auto-fixer. Triager owns GitHub verdict posting. Re-engage only on jkwak's go / fresh human comment / a PR. Canonical thread `gh-issue-shader-slang/slang-8681`. Triaged 2026-07-09 on webhook from jkwak.

**Triaged 2026-07-09:** Verified 5-bullet POSTED to GitHub by nv-slang-bot — comment 4920382715. Type=Refactoring + labels human-set, untouched. Memo: triage-8681.md.

**RE-ENGAGED 2026-07-09 — jkwak gave explicit go** (comment 4920660816): accepts the triage finding (DBI calculated before SpvOpt → identical DBI regardless of SpvOpt options), agrees to re-inject DBI after strip, "Please make a PR as we discussed." → Approach C confirmed. Routed authorization THROUGH slang-triager → slang-fixer, DRAFTS-ONLY, branch fix/issue-8681, Fixes #8681, must pass tests/spirv/separate-debug.slang, fixer must call report_pr_created. jkwak is assignee but delegated the PR to bot — STAND DOWN if he starts self-pushing. Chain now IN-FLIGHT (fix), awaiting fixer draft PR. ready-flip/merge maintainer/operator-gated.
