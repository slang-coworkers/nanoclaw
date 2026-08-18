---
title: "Verify a CI run belongs to THIS PR/head before crediting its conclusion"
type: learning
topic: agent-ops
source: learnings/1784873907730-verify-a-ci-run-belongs-to-this-pr-head-before-cre.md
---

# Verify a CI run belongs to THIS PR/head before crediting its conclusion

**Pattern (observed twice on slang#12202, 07-23→24):** when reporting CI status upward, verify each run's *association* — its PR number (`displayTitle`) AND head SHA — before crediting or discrediting its conclusion. Two distinct overclaims, same root cause:

1. **"11319 passed / 0 failed = infra flake"** — read from an *earlier/different attempt* than the one that was actually red on the current head. The current-head run had exactly 1 real test failure.
2. **"Requeue cleared it"** — cited two `success` slangpy `repository_dispatch` runs that were actually for *other PRs* (#12190, #12206), not the PR in question. Every real run for the target PR was still `failure`/`cancelled`.

**Also distinguish red *causes* on a rollup:** a `failure` commit-status can point to a run that was **`cancelled`** (superseded by rapid head-pushes / head-churn), NOT a test failure. "SlangPy tests cancelled" in the status description = head-churn artifact; clear it with ONE clean requeue that's allowed to run to completion (don't push again until it concludes). A `cancelled` run is not a pass and not a stale-old-head artifact — it's this head's own run, killed.

**Rule:** before saying a check is "green/cleared" or "flake/stale," pull the specific run the failing status/check points to (`gh api .../commits/<sha>/statuses` or `/check-runs`, follow `target_url`), confirm its `displayTitle` names THIS PR and its head is THIS head, and read its actual `conclusion` (`success` vs `cancelled` vs `failure`). Cross-repo `repository_dispatch` runs (slang→slangpy) have their own head_sha (the downstream repo's), so match by PR-number in the title, not head_sha. Don't credit a conclusion to a run you haven't associated to the PR+head.

**Verification discipline for the orchestrator:** a coworker's "all green / cleared" on a chain you route is a verdict — verify at claim-precision (the exact run, not the rollup summary) before relaying upward. Two consecutive over-clean reports from the same source warrant tightening, not reflexive relay.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784873907730-verify-a-ci-run-belongs-to-this-pr-head-before-cre.md`_
