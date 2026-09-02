---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788243467898-kohbs8
written_at: 2026-09-01T09:36:33.191Z
---

# [approver/challenger] Reviewer flag pinned at a new-code line whose concern lives in untouched pre-existing code

**Symptom.** A fuzzy reviewer (Devin, fallback tier) flags a 🔴 "Bug" at the line number of a PR's *new* branch — e.g. slang#12853 flagged "Virtual file aliases create duplicate modules" at `slang-session.cpp:254`, the opening brace of the new null-source file-load block. Taken at face value this reads as a bug the PR introduced.

**Root cause / how to catch it.** Diff the file at that line and its surroundings, not just the flagged line. Ask: does the *behavior* the reviewer describes originate in the added lines, or in pre-existing code the added path now merely *reaches*? In #12853 the module-identity/dedup behavior (pathInfo derivation `PathInfo::makeFromString`/`File::exists`→`getCanonical`, and path-registration `loadParsedModule` via `getMostUniqueIdentity`) was entirely UNTOUCHED by the diff — the diff was exactly the new null-source block plus a single `source`→`sourceBlob` arg. The non-null-source entry point already exercised that same dedup path pre-PR; the fix only let the previously-asserting null-source path reach the identical, already-shipped behavior. So the flagged concern is pre-existing and orthogonal to the PR's purpose, not PR-introduced.

**Consequence for the decision.** A pre-existing/orthogonal concern is NOT a verified PR-introduced bug ⇒ does not justify BLOCK (blocking would demand the PR fix out-of-scope code). But per the approver skill a doc carrying a 🔴 on the fuzzy fallback tier can NEVER be rounded up to WOULD_APPROVE ("uncertainty ⇒ ABSTAIN, never rounds up"). Net: forward the flag to a human, don't block a correct in-scope fix.

**Two recurring priors this reinforces, for Step-0 recall:**
1. Bot-authored PRs (`nv-slang-bot[bot]`, association CONTRIBUTOR) deterministically FAIL the `author_trust` Step-1 clause (policy trusts MEMBER/COLLABORATOR/OWNER) AND production `github-actions[bot]` review skips them ⇒ `collect-reviews.sh` exit 20 ⇒ Devin-only fallback tier. Expect ABSTAIN_POLICY:CLAUSE_FAIL:author_trust on these regardless of review content — the deterministic Step-1 reason takes precedence over any Step-3 challenger reason.
2. To locate whether a reviewer's line-pinned concern is real vs pre-existing, run `gh pr diff` filtered to the file and confirm which specific lines changed; a concern about code outside the changed hunks is by construction not introduced by the PR.
