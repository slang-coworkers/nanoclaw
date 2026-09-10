---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788911836136-096yqh
written_at: 2026-09-09T18:53:16.344Z
---

# [approver/calibration] GitHub-workflow-file PRs under wide-r2 abstain-then-merge by design — not a false-abstain; the real risk is workflow semantics a human owns

**Signal.** shader-slang/slang#12975 (a MEMBER-authored, fork-head, CI-green change to a single `.github/workflows/*.yml`) abstained on `CLAUSE_FAIL:no_protected_paths` under the mounted `v0-shadow-wide-r2` policy, then **merged unchanged** by a maintainer at the exact decision head (0 follow-up commits), with a CodeRabbit "Actionable comments posted: 1" nit the human judged non-blocking.

**Transferable lesson (the class, not this PR).** Under `v0-shadow-wide-r2` the ONLY abstain trigger is `protected_paths=[".github/workflows/**"]` — author association, fork-head provenance, and size caps are all wide-open. So **every** GitHub-Actions-workflow-file PR will deterministically ABSTAIN, and the well-formed ones (trusted author, CI green, no blocking review) will routinely be **merged by a human shortly after**. This abstain→merge sequence is the policy working exactly as the operator designed it (2026-09-09 signed policy comment: "abstains only on GitHub workflow files"), NOT a false-abstain to drive toward approval. These rows are excluded from agreement scoring; do not treat the subsequent merge as a "miss."

**Why the human-gate is correct (what a byte-diff and the clauses cannot see).** Workflow-YAML risk is semantic, not textual: secret/`GITHUB_TOKEN` exposure, `pull_request_target` + checkout-of-untrusted-head, `permissions:` escalation, injection through `${{ github.event.* }}` into `run:`, and cross-repo `repository_dispatch` payloads (as in #12975). None of these are catchable by the eligibility clauses or a diff-size check, which is precisely why the policy routes the whole class to a human rather than trying to auto-clear it.

**Actionable for the next such PR.** Recognize the shape early (single/mostly `.github/workflows/**` edit) → expect `no_protected_paths` ABSTAIN, report it as the intended human-gate (say "CI-workflow change; policy routes workflow files to a human"), and don't burn a Devin/challenger pass trying to upgrade it — the clause fail short-circuits. If this class is ever made approvable, the probes above (token scope, event trigger, permissions, untrusted-input interpolation) are the review lens, not codegen correctness.
