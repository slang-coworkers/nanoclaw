---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788574897856-erivsl
written_at: 2026-09-08T17:47:13.662Z
---

# [approver/confirmed-safe] A master-merge synchronize that leaves the PR's own files byte-identical rides the prior verdict — but the re-decision must re-cite CURRENT-head evidence, not carry the prior conclusion (calibration: #12913 WOULD_APPROVE→merged at the exact decision commit)

Calibration: shader-slang/slang#12913 (exp10 coopvec + autodiff). Decided WOULD_APPROVE at R1 (74aa3c7c); a `synchronize` pushed a new head (ddb3cdaacb7b); re-decided WOULD_APPROVE at R2; the PR then MERGED by tangent-vector at exactly ddb3cdaacb7b. Nothing changed between my decision commit and the merged head → strongest possible agreement (WOULD_APPROVE == APPROVED-equivalent, at the same SHA).

Signal class (transferable): a `synchronize` is often a **master-merge/rebase, not a content change**. Detect it cheaply before re-deriving: `gh api repos/<o>/<r>/compare/<prev_decision_sha>...<new_head> --jq '{ahead:.ahead_by,behind:.behind_by,files:[.files[].filename]}'`. If ahead_by=N/behind_by=0 and the changed files are all OUTSIDE the PR's own diff-vs-base (here: only `.github/workflows/*` + an unrelated doc, both carried in from the advanced base), then the PR's own files are byte-identical — confirm with a per-file compare (blob IDs unchanged) and note the diff_hash is unchanged. That is the "rides the prior verdict" case: the substantive correctness reasoning is unchanged.

BUT the re-decision is still a FRESH decision per the revision-chain rule, and the DECISION_REVIEW critique gate WILL block you (correctly) if your fresh challenger/investigation "carries the R1 conclusion as evidence" or says "prior analysis carries." Byte-identity permits reusing the same PROBES; it does not let you cite the prior verdict as evidence. What clears the gate: actually re-fetch the current-head source (`curl raw.githubusercontent.com/<o>/<r>/<new_sha>/<file>`) and re-cite the probes at the CURRENT head's file:line (they'll match, since bytes are identical), in every artifact — investigation.md, the decision.md challenger field, the dashboard message, AND the 5-bullet report. Codex flagged residual "carries"/"Devin re-ran on the head" wording in all four spots across multiple rounds; purge it everywhere. Also: re-harvest + re-run Devin for the new head (production review re-runs on synchronize — here it came back even cleaner, 0 findings vs R1's 1 nit); qualify Devin as "unpinned corroboration" whenever devin-commit-status.txt = "unknown".

Also (procedure gotcha): run eval-clauses.py AFTER synthesizing review-doc.md — commit_match reads commit_id from the review doc's embedded _approver_result JSON, so running clauses first yields a spurious `commit_match unevaluable`. And the record_decision ledger is append-only one-row-per-(repo,pr,commit), so a new head = a new row; the prior revision's row is untouched.
