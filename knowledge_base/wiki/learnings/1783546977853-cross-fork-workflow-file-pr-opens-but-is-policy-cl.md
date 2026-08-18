---
title: "Cross-fork workflow-file PR opens but is POLICY-CLOSED by maintainer — coworker bots can't land .github/workflows changes at all"
type: learning
topic: agent-ops
source: learnings/1783546977853-cross-fork-workflow-file-pr-opens-but-is-policy-cl.md
---

# Cross-fork workflow-file PR opens but is POLICY-CLOSED by maintainer — coworker bots can't land .github/workflows changes at all

**Addendum to the existing learning** "Pushing workflow-file changes: App token lacks workflows perm → fork + REST cross-fork PR" (`1783521395969-pushing-workflow-file-changes-app-token-lacks-work.md`). That note documents the fork+REST workaround as "verified working 2026-07-08 on slang#11989 → PR #12001." **Terminal outcome correction:** the PR opened mechanically, but the maintainer then CLOSED it unmerged on POLICY.

**What happened (slang#11989 / PR #12001, 2026-07-08):** jkwak-work closed the cross-fork draft PR with:
> "Closing because the PR is supposed to make changes to the workflow and coworker is not allowed to modify them for security reasons. I will run an agent locally."

So a coworker bot may not LAND any change whose surface is `.github/workflows/**`, regardless of a clean cross-fork PR. The fork+REST route gets you a reviewable artifact, but the maintainer takes the actual workflow edit over locally. It's not just "can't push to origin" (the `workflows`-permission push rejection) — it's "can't land at all, by policy."

**Triage-scoping lesson — act BEFORE building:** if an issue's fix lands primarily/entirely in `.github/workflows/**`, flag to the maintainer up front that a coworker bot can't merge workflow changes, and ask whether they want to own the CI edit locally — rather than spending a fixer cycle on a PR that will be policy-closed. A fix that is PART workflow + PART source may be worth splitting: land the source part as a normal PR, hand the workflow delta to the maintainer.

**On slang#11989 specifically:** the useful coworker output was NOT the PR (policy-closed) but the two spun-off compiler-fix issues that make the examples clean so the CI change becomes trivial: #12006 (E41017 false-pos on `__extern_cpp`/`export __global` host-provided globals) and #12007 (E36108 false-pos: `[require]`+GPU-op reported incompatible on auto-available `llvm` target). jkwak will make the CI-setting-only PR (`-warnings-as-errors`) himself locally once those land.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783546977853-cross-fork-workflow-file-pr-opens-but-is-policy-cl.md`_
