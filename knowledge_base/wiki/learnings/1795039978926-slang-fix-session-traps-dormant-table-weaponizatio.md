---
title: "Slang fix-session traps: dormant-table weaponization (spirv-opt), Write-tool-only plan tracker, fresh-call-only critique recording, quiz positions per head"
type: learning
topic: slang-compiler
source: learnings/1795039978926-slang-fix-session-traps-dormant-table-weaponizatio.md
---

# Slang fix-session traps: dormant-table weaponization (spirv-opt), Write-tool-only plan tracker, fresh-call-only critique recording, quiz positions per head

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795025280658-5f7tgx
written_at: 2026-11-18T22:12:58.926Z
---

# Slang fix-session traps: dormant-table weaponization (spirv-opt), Write-tool-only plan tracker, fresh-call-only critique recording, quiz positions per head

**Slang fix-session tooling traps (each cost a build or gate cycle on #14603/PR #14606):**
1. **A decline of a reviewer finding can itself be wrong — verify the "bug" at the consumer, not the table.** I declined Devin's "spirv-opt regression" claiming a SPIR-V TU passes `canCompile(SPIRV_OPT, SPIRV)`; the reviewer then verified the REAL pre-PR flow was `-pass-through spirv-opt` with **GLSL** input (both glslang spellings share the slang-glslang wrapper, which compiles GLSL and optimizes SPIR-V — slang-glslang-compiler.cpp:268-278), so enforcing the pre-existing SPIRV-only table entry regressed it. Lesson: when a gate starts enforcing a previously-dormant table, audit EVERY entry against what the downstream compiler actually consumes, and treat "the entry was pre-existing" as no defense — your change weaponizes it.
2. **plan-tracker.sh records a plan only on the Write tool** (PostToolUse matcher is Write); editing reports/<slug>.md with Edit leaves `plan_written=false` and the gate keeps firing. Each new inbound message mints a fresh workflow-state — re-Write the plan after every inbound-driven round.
3. **track-critique does not record codex-reply rounds** — every critique stage needs a fresh `mcp__codex__codex` call to count toward the delivery gate (known before, re-confirmed twice this session).
4. **formatting.sh exit code is masked by `| tail` and the script exits 1 in this container anyway** (broken gersemi shim); verify per tool: `clang-format-17 <file> | diff <file> -` must be empty, and keep new files under the 100-column limit before committing.
5. **upsert_pr_body.py quiz positions change with every head** — re-run `--quiz-positions <new head>` and re-order both the option letters and the per-question answer-restatement letters after each push.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795039978926-slang-fix-session-traps-dormant-table-weaponizatio.md`_
