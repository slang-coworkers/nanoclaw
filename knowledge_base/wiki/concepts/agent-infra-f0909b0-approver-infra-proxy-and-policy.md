---
title: "Approver Harness Infra: OneCLI Proxy, Review Harvest, and Policy-Mount Drift"
type: concept
group: agent-infra
tags: [approver, onecli-proxy, gh-paginate, abstain-infra, policy-mount, eval-clauses, harvest]
source_count: 11
---

## TL;DR

The PR-approver's harness (`collect-reviews.sh`, `harvest-reviews.py`, `eval-clauses.py`)
turns several infra faults into spurious `ABSTAIN_INFRA` decisions that burn the infra gate
for nothing. An infra abstain is the one code meaning "a real review may exist behind the
error," so it fires exactly on the highest-signal PRs. Before recording it, distinguish the
fault.

- **The OneCLI GitHub proxy is an ALLOW-LIST of path prefixes.** `repos/OWNER/NAME`,
  `search`, `graphql` are credentialed; `repositories/<id>`, `orgs/`, `user/`, `rate_limit`
  are NOT — they short-circuit locally (`{"connect_url":...,"error":"app_not_connected"}`,
  never reach GitHub). Distinct from GitHub's own `Bad credentials` and an App-token `403
  Resource not accessible by integration`. Three failures, three fixes — don't conflate.
- **`gh --paginate` 401s on page 2** on any PR with >100 reviews/comments, because GitHub's
  `Link: rel="next"` rewrites `repos/OWNER/NAME/…` → `repositories/<id>/…` (an unruled
  prefix). Hand-page on the stable `repos/` route; cross-check with
  `gh api -i "$P?per_page=1" | grep -i '^link:'`.
- **A tool-version failure is not an infra failure.** `--slurp` is a `gh` 2.47 flag; the
  container ships 2.46, so every harvest failed with `unknown flag` → exit 21 → spurious
  ABSTAIN_INFRA. Read the stderr text (`unknown flag`/`unknown command`) before accepting an
  infra abstain — same discipline as reading a 404's body, not its status code.
- **A wrapper that reports success on a failed child is worse than the bug it wraps.**
  `collect-reviews.sh` printed FETCH FAILED and exited 0; use `harvest-reviews.py` directly
  until propagation is fixed.
- **`compare/{base}...{sha}` 404s UNIVERSALLY in-container**, not per-PR — run one control
  (`compare/<any-ancestor>...<any-descendant>`); if it also 404s, hand-resolve changed paths
  from `gh pr diff --name-only` and sizes from `gh pr view --json changedFiles,additions`.
- **A missing/empty policy mount silently flips the effective policy** — resolution falls to
  the stricter bundled `v0-shadow`, so the same PR flips WOULD_APPROVE→ABSTAIN across
  sessions. This is a CLAUSE_FAIL (policy family), NOT infra. Log the resolved
  `policy_version` AND its source path on every decision and diff it per PR.
- **A mid-session OneCLI disconnect (401 `app_not_connected`) is HARNESS_FAIL**, not
  NO_REVIEW_SIGNAL and not rate-limiting (which gives 403 + a reset). It won't self-heal;
  `record_decision` still lands host-side; escalate the connect URL. The append-only ledger
  locks the head, so the operator should push a new head for a clean decision after reconnect.
- **A clean sweep needs a mechanism attached** — "no flips" and "my query missed them" are
  indistinguishable without one.

## Synthesis

### The proxy is an allow-list; pagination merely lands you on an unruled prefix

The unifying discovery is that the OneCLI GitHub proxy credentials requests by an
**allow-list of path prefixes**, not by rule per route. Measured one probe per prefix:
`repos/OWNER/NAME`, `search/issues`, `graphql` inject credentials; `repositories/<id>`,
`orgs/`, `user/`, and `rate_limit` all short-circuit locally with a
`{"connect_url":...,"error":"app_not_connected"}` body that never reaches GitHub
([the OneCLI GitHub proxy is an allow-list of path prefixes](../learnings/1786398787755-approver-infra-the-onecli-github-proxy-is-an-allow.md)).
That short-circuit body is distinct from GitHub's own `Bad credentials` (request arrived,
credential rejected) and from an App-token `403 Resource not accessible by integration`
(correct App behavior) — three different failures with three different fixes; conflating
them loses the information that names the fix.

The most common way to LAND on an unruled prefix is pagination.
`collect-reviews.sh:60,63` use bare `gh --paginate`; page 1 succeeds on `repos/OWNER/NAME`,
but GitHub's `Link: rel="next"` rewrites the path to `repositories/<numeric-id>/…`, which
`gh --paginate` follows verbatim → 401 `app_not_connected` on page 2. This fires on any PR
with >100 reviews/comments — long, contentious PRs where the primary signal matters most —
and produces a spurious exit 21 (ABSTAIN_INFRA:NO_REVIEW_SIGNAL) even when a trusted-bot
review exists at the pinned head ([collect-reviews.sh spurious ABSTAIN_INFRA on >100 reviews](../learnings/1786398105522-approver-infra-abstain-collect-reviews-sh-returns-.md)).
Interim: hand-page on the stable `repos/OWNER/NAME` route
(`gh api "$P?per_page=100&page=$pg"`, stop on the first short page); cross-check with
`gh api -i "$P?per_page=1" | grep -i '^link:'`. Root fix is one proxy rule (add
`repositories/` alongside `repos/`) which repairs every present and future consumer;
hand-paging repairs two call sites and leaves the trap armed for the next script.

### Tool-version and wrapper faults masquerade as infra

Two harvest faults are not infra at all. `--slurp` is a `gh` 2.47 flag used unconditionally
by `harvest-reviews.py`, but the container ships `gh` 2.46, so **every** harvest failed
fleet-wide with `unknown flag: --slurp` → exit 21 → spurious ABSTAIN_INFRA, and the primary
review signal was never even attempted ([every harvest failing with --slurp](../learnings/1786361776945-approver-infra-abstain-every-harvest-on-this-conta.md)).
The rule: a tool-version failure surfaces as a non-zero subprocess exit just like a network
failure, so read the stderr text — `unknown flag`, `unknown command`, `unrecognized
arguments` mean my tooling, not the remote — before accepting an infra abstain. The same
learning names a compounding wrapper defect: `collect-reviews.sh` printed the identical
FETCH FAILED line and **exited 0**, where the workflow reads 0 as "a bot review was
harvested." A wrapper that reports success on a failed child actively inverts the signal;
use `harvest-reviews.py` directly until propagation is fixed.

A third harness fault: `eval-clauses.py` derives both clause-5 (protected paths) and
clause-6 (size caps) from the `compare/{base}...{head}` REST endpoint, which **404s
universally** in the approver container — verified with a control (`compare/<master^>...<master-tip>`
also 404'd), so it is a structural limitation, not missing data for the PR
([eval-clauses compare 404s universally](../learnings/1786983440621-approver-infra-abstain-eval-clauses-compare-base-s.md)).
Don't accept the resulting CLAUSE_UNEVALUABLE ABSTAIN_INFRA: hand-resolve changed paths from
`gh pr diff --name-only` (cross-check its count against the `changedFiles` scalar) and sizes
from `gh pr view --json additions,deletions,changedFiles` (the trustworthy source; per-file
arrays truncate), evaluate the globs/caps yourself, and patch `clauses.json` to `pass` with
an evidence note stating the compare-404-is-universal control.

A fourth harvest false-negative is subtler because the exit code looks benign:
`collect-reviews.sh --commit <head>` returns **exit 20** (`harvest.json={"found":false}`
→ "no bot review AND none pending → Devin-only") while a **head-current CodeRabbit review
actually exists**, embedded in CodeRabbit's *summary issue comment* rather than the formal
`/reviews` array. The harvester keys "found" on `/reviews` (empty here) and judges staleness
by the comment's `createdAt` (its original creation time) — but CodeRabbit EDITS that summary
comment in place on each `synchronize`, so a body re-generated for the new head still shows an
old `createdAt`, and its embedded `coveredCommitId`/`change_assessment_commit` markers are
never inspected. When harvest returns 10/20/22, cross-check cheaply before falling to
Devin-only: `gh pr view <pr> --json comments --jq '.comments[]|select(.author.login=="coderabbitai")|.body'`
and grep for `coveredCommitId`/`change_assessment_commit`/`final_review_risk_coverage`; if any
equals the pinned head SHA, CodeRabbit reviewed the head — incorporate it
(`reviewers_complete=true`) instead of treating it as absent, and judge CodeRabbit staleness by
those embedded markers, never by `createdAt`. Not decision-changing on slang#12968 (Devin also
ran clean), but on a PR where Devin ALSO fails/times-out this same miss yields a spurious
`NO_REVIEW_SIGNAL` ABSTAIN — the exact slang#12064 `harvest_used=0` class the infra gate exists
to burn down. The real fix is in `harvest-reviews.py`: parse the summary-comment body's
covered-commit markers and treat a head-matching value as a harvested secondary review
([collect-reviews.sh exit 20 misses a head-current CodeRabbit summary-comment review](../learnings/1788983436175-approver-infra-abstain-collect-reviews-sh-exit-20-.md)).

### Policy-mount drift flips the same PR across sessions

`eval-clauses.py` resolves the policy in order: `--policy` → per-PR
`<ws>/policy/APPROVAL_POLICY.json` → group mount
`/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled default
`scripts/APPROVAL_POLICY.json` (= `v0-shadow`). When the group mount goes EMPTY (across
container re-creation the dir is re-made empty and root-owned), resolution silently falls to
the stricter bundled default, and the same PR's decision flips — WOULD_APPROVE under the
mounted `v0-shadow-wide` becomes ABSTAIN_POLICY under bundled `v0-shadow`
([same PR flips WOULD_APPROVE→ABSTAIN when the mount goes missing](../learnings/1788193852589-approver-infra-abstain-same-pr-can-flip-would-appr.md),
[resolved policy_version can flip a decision across sessions](../learnings/1788220724120-approver-clause-gap-resolved-policy-version-can-fl.md),
[check the policy SOURCE, not just the version](../learnings/1788222845246-approver-infra-abstain-check-the-policy-source-mou.md),
[policy mount can vanish across container re-creation](../learnings/1788232681411-approver-infra-abstain-policy-mount-can-vanish-acr.md)).
The two policies differ sharply: `v0-shadow` trusts only [OWNER, MEMBER, COLLABORATOR],
`require_ci_green:true`, protects `.github/**`+CMake+yaml+external, caps 400/30; the
human-signed policy of record `v0-shadow-wide` trusts CONTRIBUTOR/NONE/etc.,
`require_ci_green:false`, protects only `**/slang-tag-version.h`, caps 8000/150. So a
bot/CONTRIBUTOR PR touching a build file passes under wide and abstains under bundled — the
flip is entirely policy-driven.

The classification and remedy are consistent across all four learnings. Falling back is
*defined, by-design* graceful degradation, so a missing mount is a legitimate
`CLAUSE_FAIL` (policy family), NOT an infra reason code — do not burn the infra gate for it.
But: **treat `policy_version` and its source path as first-class parts of every decision**;
when a revision's clause outcome differs from a prior revision of the same PR, diff the
POLICY before attributing it to the PR (`ls -la /workspace/extra/approver-policy/` — empty =
broken mount). The check matters in both directions: a lost mount over-abstains (safe), but a
wide policy replacing a strict one would over-approve. When the mount is merely missing (the
policy of record didn't change), restore `v0-shadow-wide` into the per-PR slot
`<ws>/policy/APPROVAL_POLICY.json` (recoverable verbatim from any prior decision's
`clauses.policy_note`), re-run, record under the true version with a note, and escalate to
the operator to re-populate the mount. Do NOT reach around policy resolution to reproduce an
earlier WOULD_APPROVE — decide under the policy that actually resolves. Two related traps:
a Step-1 clause FAIL early-returns before challenger/critique, so an abstain is not a
completed would-approve; and `ci_green_on_sha` reads the legacy 2-status combined-status
API which can report `success` while a per-platform check-run has FAILED — cite the
check-runs, never restate that clause as "CI green."

### A mid-session disconnect is HARNESS_FAIL; a clean sweep needs a mechanism

Distinct from missing reviews, the OneCLI GitHub app connection can expire *within* a
session: `gh pr view` succeeds at the start of a turn, then all `gh` calls (including
`rate_limit`) 401 with `app_not_connected` mid-turn ([gh/OneCLI connection dropping mid-session → HARNESS_FAIL](../learnings/1788506787387-approver-infra-abstain-gh-onecli-github-connection.md)).
Record `ABSTAIN_POLICY reason_code=HARNESS_FAIL` (more accurate than exit-21's default
NO_REVIEW_SIGNAL, because a review very likely exists behind the auth wall and clauses are
unevaluable too), distinguish from rate-limiting (403 + reset timestamp, not 401), and
escalate the connect URL — retrying is futile. `record_decision` is host-side and works even
with `gh` down, so the row still lands and alerts; but because the ledger is append-only per
`(repo,pr,commit)`, recording HARNESS_FAIL locks this head, so the operator should push a new
head for a clean decision after reconnect. Reason_code is infra, correctly flagging OneCLI
instability as a platform-level fix.

Finally, a discipline that governs the whole family: when a corrective sweep returns a null
result ("zero past abstains flip from the --paginate bug"), that null carries no bits unless
a **mechanism** explains it. The zero here held only because #12080 (the sole multi-page PR)
crossed 100 reviews on 07-22, *after* its decisions were made — the defect is younger than
the artifacts, not absent from them, and the blast radius grows as more PRs cross the
threshold ([sweep result: zero flips, and the mechanism is timing](../learnings/1786398809580-approver-infra-abstain-sweep-result-zero-past-abst.md)).
"No flips" and "my query missed them" are indistinguishable outputs; the timestamp
comparison (harvest time vs the 100th review's `submitted_at`) is what separates them.

**Source learnings (11):**
- [Every harvest failing with `unknown flag: --slurp` (gh 2.46 < 2.47) → spurious ABSTAIN_INFRA](../learnings/1786361776945-approver-infra-abstain-every-harvest-on-this-conta.md) — a tool-version failure is not infra; read the stderr text; a wrapper reporting success on a failed child is worse than the bug.
- [collect-reviews.sh returns spurious ABSTAIN_INFRA on any PR with >100 reviews (gh --paginate)](../learnings/1786398105522-approver-infra-abstain-collect-reviews-sh-returns-.md) — `Link: rel=next` rewrites to the unruled `repositories/<id>` prefix; hand-page on the `repos/` route.
- [The OneCLI GitHub proxy is an ALLOW-LIST of path prefixes](../learnings/1786398787755-approver-infra-the-onecli-github-proxy-is-an-allow.md) — `repositories/`, `orgs/`, `user/`, `rate_limit` all uncredentialed; three distinct failure bodies with three fixes.
- [Sweep result: ZERO past abstains flip — and the mechanism is timing, not absence](../learnings/1786398809580-approver-infra-abstain-sweep-result-zero-past-abst.md) — a clean sweep is trustworthy only with a mechanism attached; the defect is younger than the artifacts, blast radius grows.
- [eval-clauses compare/{base}...{sha} 404s universally in-container — hand-resolve from gh pr diff](../learnings/1786983440621-approver-infra-abstain-eval-clauses-compare-base-s.md) — run a control; resolve paths from `gh pr diff --name-only` and sizes from `gh pr view --json`, patch clauses to pass.
- [Same PR flips WOULD_APPROVE→ABSTAIN when the group policy mount goes missing](../learnings/1788193852589-approver-infra-abstain-same-pr-can-flip-would-appr.md) — missing mount = designed graceful degradation to conservative default = CLAUSE_FAIL not infra; `ci_green_on_sha` reads legacy combined-status.
- [Resolved policy_version can flip a PR's decision across sessions — log it and diff per PR](../learnings/1788220724120-approver-clause-gap-resolved-policy-version-can-fl.md) — treat policy_version as first-class; the check matters both ways (over-abstain safe, over-approve dangerous); `/workspace/agent/policy/` is NOT in the chain.
- [Check the policy SOURCE (mounted overlay vs bundled default), not just the version string](../learnings/1788222845246-approver-infra-abstain-check-the-policy-source-mou.md) — confirm which of the 4 resolution paths won; flag the overlay disappearance as possible config drift.
- [Policy mount can vanish across container re-creation → silently uses bundled v0-shadow](../learnings/1788232681411-approver-infra-abstain-policy-mount-can-vanish-acr.md) — restore v0-shadow-wide into the per-PR slot from a prior policy_note; escalate to re-populate the mount; canonical wide-policy contents recorded.
- [gh/OneCLI GitHub connection dropping mid-session → HARNESS_FAIL](../learnings/1788506787387-approver-infra-abstain-gh-onecli-github-connection.md) — distinct from rate-limiting; record_decision still lands but locks the head; escalate the connect URL, push a new head after reconnect.
- [collect-reviews.sh exit 20 misses a head-current CodeRabbit summary-comment review (slang#12968)](../learnings/1788983436175-approver-infra-abstain-collect-reviews-sh-exit-20-.md) — harvest keys "found" on /reviews and staleness on createdAt, but CodeRabbit edits its summary ISSUE comment in place on synchronize; cross-check the body's coveredCommitId/change_assessment_commit markers vs the pinned head before Devin-only.
