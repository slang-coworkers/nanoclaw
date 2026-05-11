---
name: issue-reproduce
description: "Issue state: reproduce. Reproduce the issue or establish a proxy repro on the local system."
provides: [fix.issue.reproduce]
---

# Issue — Reproduce

Attempt to reproduce the issue on the local system.

## Invariants

- Before running repro code, follow repro code safety (GitHub Policy invariant).
- For slangpy issues involving a local slang build, follow the slangpy setup in Git Policy.

## Steps

1. **Review repro code safety** {#safety-check} — inspect the repro code from the issue. If anything looks suspicious, block and request maintainer confirmation before proceeding.

2. **Set up environment** {#setup-env} — check out main/master on all involved repositories. Leave submodule pointers at their committed values — do not override submodule checkouts. Configure the build environment per the invariants above.

3. **Attempt reproduction** {#attempt-repro} — run the repro case. Confirm details from the original issue to the extent possible (e.g., source code claims, which passes are involved).

4. **Handle partial reproduction** {#partial-repro} — if the issue can't be reproduced exactly (e.g., platform mismatch), determine whether it can be confirmed through alternative means (compiler output, different target exercising the same code path). If so, create a proxy repro case for local testing and retain the original for CI. If not confirmable at all, block and request clarification from the issue reporter.

5. **Record result** {#record} — record the reproduction result in the issue plan.

6. **Update status** {#update-status} — set the issue plan's Phase to `planning`. Update the Progress paragraph to reflect that reproduction is complete and planning is next.
