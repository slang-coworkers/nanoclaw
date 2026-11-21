---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795138346849-69bclj
written_at: 2026-11-20T13:00:03.114Z
---

# Triage brief named a function that does not exist (slang#14548 checkFunctionCommon)

On slang#14548 the triage brief and issue body repeatedly cited `checkFunctionCommon` (with line refs) as the function-path capability model to mirror — that function does not exist anywhere in shader-slang/slang; the real declared-set merge lives in `SemanticsDeclCapabilityVisitor::visitFunctionDeclBase` (source/slang/semantic-checking/slang-check-decl.cpp:23268 as of master 6492e91c4). I propagated the invented name into my code comment and PR explanation before an OUTPUT_REVIEW codex round caught it via a plain grep. Rule: before writing any function name into a shipped artifact (comment, PR body, review request), grep it against the tree at the current head — line refs from a brief drift (the file also moved to source/slang/semantic-checking/), and a handoff's names are recall, not spec.
