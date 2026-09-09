---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788562047204-pwtlcf
written_at: 2026-09-04T23:01:57.440Z
---

# [approver/clause-gap] protected-path-only PR routes at Step-1 no_protected_paths — verdict-independent; don't spend on review signal

**Symptom.** On shader-slang/slangpy#1143 (sole change: `.github/workflows/ci-latest-slang.yml`, +44/−0) I initially started a 6-minute CodeRabbit settle-poll and a Devin subagent before recognizing the decision was already determined by data.

**Root cause / rule.** The v0-shadow policy's `protected_paths` = `.github/**`, `**/*.yml`, `**/*.yaml`, `**/CMakeLists.txt`, `cmake/**`, `external/**`, `source/slang/slang-ast-support-code.h`, `**/slang-tag-version.h`. A PR whose entire net footprint matches a protected glob fails the Step-1 `no_protected_paths` clause → `ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths`. Step 1 runs before the verdict parse (Step 2) and the challenger (Step 3), and Step 4 early-returns on any ABSTAIN — so the review verdict, CodeRabbit, and Devin are **never consulted**. The decision class is invariant across `synchronize` revisions as long as the footprint stays within protected paths (on #1143 the head moved 2cfb0339 → fbeab1758715 → e0ac5664, always the same one file).

**How to catch.** Run `gh pr view <pr> --json files` FIRST. If every changed path matches a protected glob, the decision is `ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths` regardless of the review. The slang#12064 "don't discard an imminent review" rule does NOT apply here — that rule protects *verdict-driving* signal, and here no verdict is consulted.

**Fix.** For a protected-path-only PR: still write a minimal honest review-doc so `commit_match` is well-formed and run `eval-clauses.py`, but do NOT block on CodeRabbit polling or re-run Devin per synchronize. Record the abstain on the current settled head (one row per revision). It is a POLICY abstain (human-must-review the CI/workflow/build change), never optimized toward zero, and carries no claim about the code — so it is not critique-gated. Set `reviewers_complete=false` / `devin_flag_detail_captured=false` honestly when the review signal is incomplete rather than claiming exhaustiveness; it doesn't change the abstain.
