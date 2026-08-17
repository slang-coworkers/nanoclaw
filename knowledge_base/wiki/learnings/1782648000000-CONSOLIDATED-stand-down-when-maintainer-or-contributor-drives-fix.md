---
title: "CONSOLIDATED — stand down when a maintainer/contributor is already driving the fix"
type: learning
topic: misc
source: learnings/1782648000000-CONSOLIDATED-stand-down-when-maintainer-or-contributor-drives-fix.md
---

# CONSOLIDATED — stand down when a maintainer/contributor is already driving the fix

*Consolidation (2026-06-28) of 7 per-issue postmortems where a correct/near-correct bot draft was superseded by a maintainer's or external contributor's PR: #11531→#11577, #11395→#11523, #11606→#11607, #11454→#11520, #11359→#11458, #11473→#11554, #11330→#11696. All seven issues are CLOSED-COMPLETED (verified 2026-06-28). The recurring lesson is about **ownership and draft hygiene, not correctness** — in most of these our root-cause and tests were right (one, #11531/#11577, was adopted verbatim). Two postmortems with distinct *technical* lessons are kept standalone: #11465 (representation-canonicalization gap) and #11759 (RPC stress-timeout vs concurrency).*

## The rule

When an issue already has a maintainer/external contributor active on it, a competing bot PR is likely to be closed even when correct. Our durable value is the **analysis + tests**, not the merge. Bias toward advisory triage; if you draft, keep it thin and parked, and close it promptly the moment the issue closes.

## How to detect "already being driven" at triage

- **Check `assignees`.** An assigned maintainer ⇒ expect a competing bot PR to be stood down. (#11395 — assigned to @expipiplus1, our near-identical #11424 closed.)
- **Scan for an active external contributor / linked PRs / "I'll take this" comments:** `gh api repos/<o>/<r>/issues/<n> --jq .closedByPullRequestsReferences` AND `gh pr list --search "<n> in:body"`. (#11606 — external @klukaszek's #11607 landed first; `slang-ir-legalize-varying-params.cpp` / Metal varying-param legalization is a recurring external-contributor hotspot.)
- **A/B where A = maintainer:** open the B-side *thin or not at all* and explicitly park it "B — maintainer-A driving"; don't advance it. (#11454, #11359.)

## Draft hygiene — don't let a parked draft rot

- **`watch-only` is not "parked forever."** Each supervisor tick, re-confirm the parent issue is still OPEN. The instant a maintainer/other PR closes it, decide **close-our-superseded-draft** or **refile the remaining scope** — don't leave an orphaned draft against a closed issue. (#11330 — our #11334 sat stale-OPEN for a month against a closed umbrella; #11359 — #11440 sat OPEN as dead weight after we publicly conceded.)
- **When triage publicly concedes** to a reporter's/maintainer's counter-evidence, close our draft in the **same turn** with a one-line "deferring to maintainer fix" pointer. (#11359.)
- **Keep the chain tracked until the maintainer PR actually MERGES**, not when it opens — maintainer PRs can stall or close-unmerged too. Trigger archive only on merge. (#11473.)
- Closing our *own* superseded draft is authored by the owning fixer (closest-to-state), **not** force-closed from the supervisor session (operator "never unilaterally close" rule).

## When our fix was correct

- Getting the diff + tests in front of an already-active maintainer **early** (in the triage comment or as a ready-to-apply diff) lets them adopt it directly — #11577 took our #11531 source fix **and regression tests verbatim**. This is a validation signal for the pipeline, not a loss. Keep shipping tests-with-fix.
- **For source-location-on-diagnostics fixes, always include a cross-module test variant** (symbol imported from a separate module), not just same-module — that's the coverage reviewers expect, and the merged #11523 added exactly that over our #11424.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782648000000-CONSOLIDATED-stand-down-when-maintainer-or-contributor-drives-fix.md`_
