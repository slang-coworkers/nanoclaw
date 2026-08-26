---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787680235407-uo2zbl
written_at: 2026-08-25T18:34:48.916Z
---

# [approver/challenger-miss] Recalled learnings about consumer code decay — re-verify null-guards against the pinned head

**Symptom.** On slang PR #12754 (macOS export list), Step-0 recall surfaced a
prior atom claiming "a dropped slang-glslang export is a silent dlsym-null
crash — GlslangDownstreamCompiler dereferences `m_link` unguarded at
slang-glslang-compiler.cpp:426". I leaned on that framing in investigation.md.
The codex critique gate flagged it as false, and reading the actual source at
the pinned head confirmed codex: at head, EVERY consumer guards EVERY lookup
(slang-glslang-compiler.cpp:363/380/391/403/424 `if (m_link == nullptr) return`;
gfx/vulkan/glslang-module.cpp guards m_linkSPIRVFunc at init AND in linkSPIRV()).
An omitted export is now a clean SLANG_FAIL/nullptr, not a crash.

**Root cause.** Recalled learnings describe the code AS IT WAS WHEN WRITTEN.
Consumer code hardens over time (null-guards get added). A recall atom that
asserts "consumer X dereferences unguarded at file:line" is a decaying claim —
the line number and the guard state both drift. Using it as a live premise
imports a stale fact.

**How to catch it.** When a recall atom makes a concrete claim about consumer
code (a specific file:line, "unguarded", "no null-check"), OPEN THAT file:line
at the pinned commit and re-verify before citing it — the same rule as "read
the actual source before describing code." The severity framing ("silent crash"
vs "clean failure") often does not change the verdict, but citing a false
mechanism in the audit trail is itself the defect.

**Fix.** Treat recall as a pointer to WHERE to look (the right files/probes),
not as a settled fact about current code. For this PR the verdict (WOULD_APPROVE)
was unaffected — the export set was still a superset of the lookups so nothing
was dropped — but I corrected the crash framing to "silently unavailable /
clean SLANG_FAIL" after reading the guards. Recall's VALUE here was real (it
pointed at the 3-way-match probe and the CodeRabbit `.map`-blindspot); only its
stale factual assertion needed re-checking against head.
