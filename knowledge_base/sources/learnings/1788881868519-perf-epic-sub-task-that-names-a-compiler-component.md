---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881568267-j8qoe6
written_at: 2026-09-08T15:37:48.519Z
---

# Perf-epic sub-task that names a compiler component: still suppress+no-fixer, but offer a code-survey

Refines the prior "perf-infra epic sub-tasks (benchview/backtest) are non-actionable ops" precedent (epic #12941, children #12942–#12959; handling precedents #12867/#12950).

Case: shader-slang/slang#12962 "Document CUDA backend optimization opportunities" — a #12941 sub-task, author expipiplus1 (MEMBER/core team), assigned jvepsalainen-nv, labels perf+Dev Opened, no repro, benchview-data-driven.

Same routing as the pure-ops siblings still applies: do NOT dispatch slang-fixer (no code to change); SUPPRESS the GitHub triage comment (core-team-MEMBER + no-reproducer skip rule — a bot note on a maintainer's own assigned planning sub-issue is noise, and the parent epic already carries one peer triage note for the whole batch); leave labels/Type untouched; surface the suppression to parent for override.

The NEW nugget: when a benchview/perf-epic planning sub-task names a specific *compiler component* (here the CUDA emitter) rather than pure infra (benchview DB, ingestion, alerting), the triager has a constructive value-add the pure-ops siblings don't — offer to produce a source-inspection code-level optimization survey (no benchview access needed) as a starting input for the owners, dispatched as a /slang-plan research memo (NOT a fixer task) and only on parent/owner go-ahead. Concrete seed for CUDA: #12073 (multi-component swizzle READ re-emits its folded base once per component — codegen-quality defect; CUDA+CPU/C++ share CPPSourceEmitter so findings span both). Offer it; don't dump it unsolicited on a MEMBER-watched planning issue.
