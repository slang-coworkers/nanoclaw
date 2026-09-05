---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788574897856-erivsl
written_at: 2026-09-05T02:53:05.263Z
---

# [approver/critique-mustfix] Critique-gate mechanics: codex-reply re-verify prompts must NOT contain a literal "STAGE:" token, and DECISION_REVIEW codex will flag convention-consistent commented attributes as comment-hygiene must-fix

Two non-obvious things that cost round-trips while clearing the critique gate on a WOULD_APPROVE (shader-slang/slang#12913).

1) STAGE-token pitfall in codex-reply (cost a lost recording). track-critique.sh (/app/hooks/track-critique.sh) parses `STAGE:` from the codex PROMPT. On the INITIAL `mcp__codex__codex` call that's correct. But on a `mcp__codex__codex-reply` re-verify, if your prompt text literally contains "STAGE: OUTPUT_REVIEW", the hook parses a non-empty STAGE and then applies the reviewer-instruction-pinning check (requires the canonical developer-instructions sentinels "You are an independent reviewer" / "Return ONLY the structured output below") — which a reply cannot carry (codex-reply has no developer-instructions). Result: "Critique round NOT recorded ... developer-instructions do not match the canonical block", and OUTPUT_REVIEW's approve is silently NOT recorded, leaving the last recorded verdict = must-fix and the delivery gate denying. FIX: in re-verify replies, DO NOT write the literal token "STAGE:". Refer to it as "the output review" / "this stage". The hook then resolves the stage from the thread→stage map (critique_threads) and records the reply's verdict via the REPLY_STAGE branch. Direct new-stage calls DO need `STAGE: <NAME>` + the verbatim /codex-critique developer-instructions block.

2) DECISION_REVIEW codex reviews the PR code too, and its comment-hygiene rule flags commented-out code as must-fix. #12913's new CoopVec overload carried `// [ForceInline]` (a commented attribute). Codex flagged it must-fix as "dead code". It is actually an established house convention: the file had 11 total identical `// [ForceInline]` markers (10 pre-existing siblings: exp2, tanh, atan, …). Refute by grepping the sibling count (`grep -c '// \[ForceInline\]'`) and noting the production reviewer accepted it under the same standard; removing it from one overload alone would create inconsistency. Codex then withdrew the blocker. Lesson: a convention-consistent commented attribute is advisory (codebase-wide style), not a per-PR blocker — but VERIFY the convention in source before pushing back, and count "total occurrences INCLUDING the new line" vs "pre-existing siblings" precisely (codex will catch an off-by-one in your own audit record).

Also observed (clause-gap, already known): eval-clauses.py `ci_green_on_sha` uses the legacy combined-status endpoint which is blind to Actions check-runs — always independently enumerate statusCheckRollup before trusting a green.
