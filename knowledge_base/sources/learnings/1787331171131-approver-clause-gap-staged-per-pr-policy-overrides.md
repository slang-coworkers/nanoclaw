---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787330600956-g0jxmf
written_at: 2026-08-21T16:52:51.131Z
---

# [approver/clause-gap] staged per-PR policy/ overrides the wide mount → strict v0-shadow fires forks+400-line cap

## Symptom
PR shader-slang/slang#12282 ("Add CPU RayQuery support", author WeakKnight) got `ABSTAIN_POLICY` with THREE clause FAILs — `author_trust` (CONTRIBUTOR), `head_provenance` (fork head `WeakKnight/slang`), `tier_eligible` (554 lines > 400) — under `policy_version=v0-shadow`. Recent slang PRs have been evaluating under the mounted `v0-shadow-wide` (forks allowed, ~20× looser caps: 8000 lines / 150 files, and `protected_paths` reduced to only `**/slang-tag-version.h`). Two of the three FAILs here (head_provenance, tier_eligible) exist ONLY under the strict bundled default.

## Root cause
`eval-clauses.py` policy resolution order is: `--policy` → **staged `<ws>/policy/APPROVAL_POLICY.json`** → group mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled `v0-shadow` default. The `/slang-pr-approve` staging step (and here, my own `cp` of the skill-dir bundled default into `work/…/policy/`) writes the **bundled strict `v0-shadow`** into the per-PR `policy/` dir, which is FIRST in the order after `--policy` — so it OVERRIDES the wide group mount silently. This is the same override trap noted for #12084/#12452 (a prior turn staging the bundled default caused a spurious `head_provenance` fail). The tell is always `clauses.json.policy_version` = `v0-shadow` (strict) vs `v0-shadow-wide` (mount).

## How to catch it
BEFORE trusting any clause FAIL (especially `head_provenance` on a fork PR, or `tier_eligible` near 400/8000), READ `clauses.json.policy_version`. If it says `v0-shadow` on a repo where the intended effective policy is `v0-shadow-wide`, the workspace staged the bundled default. Do NOT stage the skill-dir `APPROVAL_POLICY.json` into `work/…/policy/` unless you intend the strict policy — leaving `policy/` empty lets the mount (or bundled default if no mount) apply. Fails SAFE (over-abstains), which is exactly why it survives unnoticed — its symptom is indistinguishable from diligence.

## Fix
For a shadow-mode ABSTAIN this is defensible (over-abstain, hands to human), and #12282 is a genuine feature PR from a fork by a contributor exceeding the source-line cap regardless of policy width in at least the author_trust dimension. But when the intent is the wide policy, either (a) don't stage `policy/` at all, or (b) copy the group mount, not the skill-dir bundled default. Twin outcome: #12310 was the same `tier_eligible` clause-fail and joined as an OVER-ABSTAIN (merged unchanged at head). Score any `CLAUSE_FAIL:tier_eligible`/`head_provenance` abstain against the falsifiable reading, and note the policy version in the row.
