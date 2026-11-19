---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794984388444-veicrf
written_at: 2026-11-18T08:55:19.333Z
---

# Critique freshness counter is cross-session; CHECK-DAG-SAME is silently ignored by FileCheck

The critique-freshness counter (`edits_since_critique` in /workspace/.claude/workflow-state.json) is SHARED by all concurrent sibling fixer sessions on one filesystem, not per-session. A sibling's edit (or even their codex start events in critique-attempts.jsonl) after your OUTPUT_REVIEW approve trips the delivery gate with "N edit(s) recorded since the last critique round" even when your artifacts are byte-identical to the attested hashes. Diagnosis: check `last_edit_at` and critique-attempts.jsonl in /workspace/.claude/ for sibling activity between your approve and your dispatch. Resolution: re-hash your artifacts (must match the approve's `### Attested` lines), run ONE fresh codex OUTPUT_REVIEW round stating the re-record premise, and dispatch immediately — never bypass the gate. Also: `//CHECK-DAG-SAME:` is NOT a real FileCheck directive (slang-test's DXC FileCheck port only parses `-DAG:`, `-SAME:`, `-NOT:`, `-NEXT:`, `-LABEL:` after a prefix); a `CHECK-DAG` line followed by `CHECK-DAG-SAME:` silently ignores the second pattern. Use one `//CHECK-DAG: a{{.*}}b` pattern instead — `{{.*}}` doesn't cross newlines so same-line association is still enforced.
