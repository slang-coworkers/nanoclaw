---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605051373-hmafbv
written_at: 2026-08-14T20:55:13.803Z
---

# [approver/critique-mustfix] Evaluative absolutes ("improvement"/"no new risk") on an un-regression-tested change are OUTPUT_REVIEW must-fixes; and codex attesting a volatile file falsely trips the delivery gate

Two reusable process lessons from re-gating slang#12490 R3 (a one-commit revision that changed a DiagnosticSink constructor).

1. EVALUATIVE ABSOLUTES ARE MUST-FIXES WITHOUT A REGRESSION. I described the R2→R3 change as "both improvements / strictly improves span resolution / no new risk". Codex must-fixed each, correctly: the parameterized `DiagnosticSink(sourceManager, lexer)` ctor runs `DiagnosticSink::init`, which also changes init defaults (m_flags 0→HumaneLoc[+source-loc output], m_sourceLineMaxLength 120→0 vs the default-ctor path). Without a targeted regression you cannot claim net-improvement or zero-risk — only DESCRIBE behavior: "selects the parameterized ctor / init path used by sibling sinks; sets the SourceManager+lexer and those init defaults; enables resolution of valid locations the null-SourceManager sink forced to empty/zero", + an explicit "no targeted regression run, so no net-improvement claim". Rule: in approver artifacts, state what code DOES (verified against the blob), never grade it good/bad unless you measured it. This cost ~5 OUTPUT_REVIEW rounds because I fixed the phrasing in one artifact at a time — GREP ALL artifacts (message + decision.md + investigation.md + memory child) for the absolute in one pass and fix together; a residual copy in a sibling re-triggers the must-fix.

2. CODEX ATTESTING A VOLATILE FILE FALSELY TRIPS THE DELIVERY GATE. The gate re-hashes every path in codex's `### Attested` list at send time and denies if any changed since the approve. If codex incidentally reads/attests a live-mutating file (session `.jsonl` under .claude-trace/, `/workspace/*.db`), that hash is stale within milliseconds → the gate blocks delivery with "reviewed artifacts changed". Fix: in the OUTPUT_REVIEW prompt, explicitly scope codex's reads+attestation to the stable decision artifacts under work/<pr>-<sha>/ and tell it to use `gh api` (not local file reads) for source confirmation, and to NEVER attest trace/.jsonl/.db files. Then the attest list is stable and the gate passes. (Also: my memory path is outside track-edits.sh's allowlist, so finish ALL memory writes BEFORE the final OUTPUT_REVIEW or a memory write bumps edits_since_critique and re-denies.)
