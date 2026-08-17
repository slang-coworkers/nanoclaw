---
title: "[approver/human-disagreement] Small release-packaging PRs touching .github/**: ABSTAIN_POLICY confirmed correct; CodeRabbit 'Major' packaging-robustness nits are non-blocking 🟡, not 🔴"
type: learning
topic: review-approval
source: learnings/1783964691555-approver-human-disagreement-small-release-packagin.md
---

# [approver/human-disagreement] Small release-packaging PRs touching .github/**: ABSTAIN_POLICY confirmed correct; CodeRabbit "Major" packaging-robustness nits are non-blocking 🟡, not 🔴

**Class of change.** Small release-packaging additions that add license/asset files to release artifacts by touching BOTH a CI workflow under `.github/**` (e.g. `cp -R LICENSES` into archive-staging steps) AND a CMake `install(DIRECTORY …)` rule. Example: slang#12085 (+9/-0 across `.github/workflows/release.yml` + `CMakeLists.txt`).

**Decision vs. outcome (calibration data).** Decided **ABSTAIN_POLICY** (`CLAUSE_FAIL:no_protected_paths`) — the `.github/**` touch fails the Step-1 protected-path clause and short-circuits before the challenger. Human outcome: **merged unchanged** ~1h later by the author (a COLLABORATOR), decision commit == merged content. So:

1. **The protected-path ABSTAIN was the right call and cost nothing.** A human maintainer was always going to look at a CI-workflow change; the abstain routes it there. Not a miss — ABSTAIN_POLICY is excluded from agreement scoring and the merge is consistent with "human looked, accepted." Don't second-guess the short-circuit for this class; it's the system working.

2. **CodeRabbit "🟠 Major / potential_issue" ≠ 🔴 bug.** CodeRabbit flagged a real robustness gap (CMake `PATTERN ".*" EXCLUDE` can package a partial `LICENSES/` dir; no validation that expected license files are present before packaging). It merged as-is — confirming this was correctly synthesized as a **non-governing 🟡 gap**, not a 🔴 that would map to BLOCK/REQUEST_CHANGES-as-blocker. **Signal to probe next time:** a CodeRabbit finding whose blast radius is "an artifact could be incomplete" (missing-file / partial-copy / no-validation) on a packaging or docs path is a 🟡 robustness gap — surface it as advisory, do not let its "Major"/"potential_issue" label round the verdict toward blocking. A 🔴 requires a *proven* wrong behavior on a reachable path, not a hardening opportunity.

**How to catch it.** On this shape: (a) trust the protected-path clause fail → ABSTAIN_POLICY, don't run the challenger; (b) when synthesizing the fallback-tier verdict, weigh CodeRabbit findings by *what breaks* not by CodeRabbit's severity chip — "the packaged archive might omit a dotfile license" is 🟡, and the eventual merge-as-is bears this out.

**Confirmed-safe summary.** This change shape (release-packaging file additions, CI + CMake, tiny diff, trusted author) is routinely merged with open CodeRabbit robustness nits. ABSTAIN_POLICY on the `.github/**` gate is correct and expected; no false-safe risk here because the approver never approved.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783964691555-approver-human-disagreement-small-release-packagin.md`_
