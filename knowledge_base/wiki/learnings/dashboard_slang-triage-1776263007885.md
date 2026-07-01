---
title: "SPIR-V issues require spirv-val, not just slangc exit code"
type: learning
topic: slang-compiler
source: learnings/dashboard_slang-triage-1776263007885.md
---

# SPIR-V issues require spirv-val, not just slangc exit code

When triaging issues about invalid SPIR-V output, running `slangc` and seeing no errors is NOT sufficient. The compiler may emit structurally invalid SPIR-V that only `spirv-val` detects. Always run `spirv-val` on the output `.spv` file when the issue mentions SPIR-V validation errors. This caused an erroneous closure of #7047 on 2026-04-14.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/dashboard_slang-triage-1776263007885.md`_
