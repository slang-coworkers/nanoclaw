---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787309677123-afe6nq
written_at: 2026-08-21T11:05:01.140Z
---

# [approver/challenger-miss] DO-NOT-MERGE repro PR that disables CI is a CHALLENGER_CONCERN abstain, and CodeRabbit auto-skips it

## Symptom
slang#12658 "DO NOT MERGE: repro loop for #11147" — a temporary throwaway PR (2 CI-YAML files, +67/−117, no product code) that replaces the T4 test step with a 300× loop over one test and sets `if: false` on ~30 build/test/gate jobs. Body: "Temporary, throwaway PR — not for review or merge … Close this PR without merging regardless of outcome." The mechanical fallback-tier verdict came out APPROVE (0 bugs from a CodeRabbit skip + a clean Devin run), which one-directionally slides toward WOULD_APPROVE.

## Root cause / correct call
`WOULD_APPROVE` means "I would approve MERGING this." Merging a DO-NOT-MERGE CI PR that disables the CI matrix is a master CI-integrity regression the author explicitly forbids. That is a **CHALLENGER_CONCERN → ABSTAIN_POLICY** (a human — the author — must close it unmerged), NOT:
- not WOULD_APPROVE: a clean challenger investigation can only add caution, never upgrade past an explicit do-not-merge;
- not BLOCK: BLOCK is a verified 🔴 code defect; the YAML is correct for its stated purpose (Devin clean), the problem is that it must not be merged;
- not an INFRA abstain: the pipeline ran end-to-end (harvest, Devin, all clauses), so the abstain is POLICY, not a NO_REVIEW_SIGNAL/HARNESS_FAIL infra code.

## How to catch it (two mechanical signals)
1. **Title/body intent markers** ("DO NOT MERGE", "throwaway", "temporary", "repro", "not for review or merge", "revert before merge" comments in the diff) → the change is intent-forbidden from merging → abstain on CHALLENGER_CONCERN regardless of how clean the bots are. Ask "would merging this as-is be correct?" not "is the YAML defect-free?".
2. **`collect-reviews.sh` exit 20 on such a PR is EXPECTED, not an infra gap:** CodeRabbit's `.coderabbit.yaml` auto-**skips** review when the title contains an ignored keyword (`DO NOT MERGE`, `WIP`) — it posts a "Review skipped" status comment with no findings, and production claude-code-action commonly doesn't post either. So the fallback tier is Devin-alone, `reviewers_complete=true` (Devin ran), and the abstain reason is the intent marker (POLICY), never NO_REVIEW_SIGNAL. Don't mis-file the missing bot review as infra.

## Fix
For any PR whose title/body/diff-comments forbid merging or mark it throwaway/repro/temporary: the correct decision is ABSTAIN_POLICY. Pick the reason by what dominates — CLAUSE_FAIL if a Step-1 clause (size cap, protected path) also fails and is terminal; otherwise CHALLENGER_CONCERN for the do-not-merge intent. Never WOULD_APPROVE. (Precedent: slangpy#1063 DO-NOT-MERGE Profiler abstained on tier_eligible clause fail; slang#12658 abstained on CHALLENGER_CONCERN because it passed all clauses under the wide shadow policy.)
