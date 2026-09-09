---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786954180580-tiafms
written_at: 2026-08-17T19:42:57.303Z
---

# [approver/challenger-miss] Code-diff comment-hygiene does not govern a metadata/suppression-list file against its own merged convention

**Symptom.** On slang PR #12571 (WOULD_APPROVE, later MERGED unchanged = confirmed HIT), the codex critique gate twice returned must-fix demanding the author strip a ~10-line comment added to `docs/generated/tests/_meta/expected-failures.txt` — the comment recorded nightly run IDs, "why this test wasn't listed with the earlier victims," and how the ordering-dependence (leak vs. flake) was confirmed. Codex read this as change-history/scratchpad narration that its comment-hygiene rule bans, and wanted to downgrade the decision to ABSTAIN_POLICY:CHALLENGER_CONCERN.

**Root cause.** The reviewer's comment-hygiene rule is textually scoped to "when a code diff is under review." An expected-failures / test-suppression list is METADATA, not code — and this particular file's established, already-merged convention *is* to document, per entry, which nightly run it failed on and why the leak (not a genuine test bug) is the cause, precisely so a maintainer can later remove the entry correctly. Applying the code-diff hygiene rule here (a) misapplies scope and (b) asks the PR author to break the file's own maintainer-approved convention, which is outside author responsibility.

**How to catch it.** When a critique flags a comment as a hygiene defect, before accepting it: (1) confirm the file is code vs. data/metadata — the rule is code-scoped; (2) read the BASE (master) version of the same file for precedent — `gh api ".../contents/<path>?ref=master" | base64 -d`. Here the merged "fourth victim" entry carried the identical style (run id 31361305751, "why not listed then", per-`.N`-directive analysis). A new entry matching the file's own merged convention is an author-convention match, advisory-at-most, with zero decision blast radius — not a CHALLENGER_CONCERN and not grounds to round a WOULD_APPROVE up to ABSTAIN. The merge confirmed it: the comment shipped verbatim, untouched by any human.

**Fix.** Adjudicate critique findings on evidence, not deference. A code-diff rule does not automatically transfer to a metadata file; the base-branch convention is the ground truth for what the author should/shouldn't change. Distinct, separately-valid catch from the same review: codex was RIGHT that "production PR review skips fix/* branches" was false — the Claude review job runs on fix/* (workflow skips only drafts/[bot]/claude/*, and docs/** is in its paths filter); it had errored HTTP 429 rate_limit (job log 95323942287), posting no review. Verify provenance claims against the workflow file + job log, not from memory.
