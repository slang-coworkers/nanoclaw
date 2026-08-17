---
title: "[approver/challenger-miss] discharge cheap advisory flags instead of forwarding them — a 2-file lookup would have killed a false positive I relayed 4×"
type: learning
topic: review-approval
source: learnings/1785856625138-approver-challenger-miss-discharge-cheap-advisory-.md
---

# [approver/challenger-miss] discharge cheap advisory flags instead of forwarding them — a 2-file lookup would have killed a false positive I relayed 4×

## Symptom
Across all four revision reports on slangpy#1084 I forwarded a Devin "Investigate" flag as an open item worth a maintainer's eye: *"verify the `ci`/`checks` `workflow_run` names at `pr-checks-complete.yml:36-37` match slangpy's real workflow `name:` fields, else the CI-completion relay silently never fires."* The orchestrator checked `main` directly and it was a **false positive**: `.github/workflows/ci.yml` line 1 is `name: ci`, `.github/workflows/checks.yml` line 1 is `name: checks` — both match exactly, the relay fires. (I independently re-verified before accepting the correction: confirmed.) The reason it was "never addressed" across four pushes is that there was nothing to fix. The orchestrator nearly published it upstream as a real defect.

## Root cause
Devin flagging it is legitimate — a diff-scoped reviewer cannot know sibling-file `name:` values. But *I* could: `gh api repos/<r>/contents/.github/workflows/ci.yml?ref=<sha>` on two files, ~10 seconds. Forwarding is cheaper than checking in the moment, so a flag that arrives pre-worded as an open item gets relayed rather than resolved — and each repetition makes it look more real, not less. **An unresolved advisory repeated N times reads to the recipient as a confirmed defect with N confirmations.**

## How to catch it
Before putting any advisory flag in a report, ask: *what would it cost me to settle this right now?* Two classes to always discharge, never forward:
- **"Do these names/IDs/paths match?"** — resolvable by reading the referenced files (`workflow_run.workflows` vs each workflow's `name:`; secret names vs repo secrets; reusable-workflow inputs vs the callee's `on.workflow_call.inputs`).
- **"Is this flag/config actually set anywhere?"** — the dead-flag probe already in my standing orders; same discipline, applied to advisories rather than gating logic.
Then report the *resolved* state ("verified: `ci`/`checks` match `ci.yml`/`checks.yml` — relay will fire") instead of the question. Forward only what genuinely needs judgment or context I don't have.

## Fix / calibration
This applies on the ABSTAIN path too — arguably more, since a protected-path short-circuit means the advisory list IS the whole informational value of my report to the human. Getting it wrong is the one way an abstain can mislead. Note the asymmetry with gap severity: for a *gating* 🟡 gap, uncertainty ⇒ ABSTAIN (never resolve toward approval); but for an *advisory* item that doesn't move the verdict, uncertainty ⇒ go look, don't forward the uncertainty. Also: verify a correction to my own output before accepting it (I did here) — accepting an unverified claim is the same failure as forwarding an unverified flag. Related: [[approver-clause-gap-on-an-abstain-early-return-the-critique-gate-is-skipped]] — same theme, the cheap/short-circuit path is the least-verified one.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785856625138-approver-challenger-miss-discharge-cheap-advisory-.md`_
