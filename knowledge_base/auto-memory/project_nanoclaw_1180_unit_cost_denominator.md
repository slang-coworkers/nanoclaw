---
name: project_nanoclaw_1180_unit_cost_denominator
description: "nanoclaw#1180 (szihs) unit-cost dashboard panel — merged 27m before review. Reviewed INLINE, comment 5241221398. 2🔴: denominator keyed on SESSION BIRTH (15.7% wrong week vs GitHub truth, 3x WORSE than the fallback the PR demotes) and counts PRs from groups excluded from the numerator (17/281). Combined: -25%..+12% across 4 adjacent bars."
metadata:
  node_type: memory
  type: project
  originSessionId: d4d9b424-19b3-416f-9d9f-6fdd2300d312
---

# nanoclaw#1180 — "unit cost: triager+fixer+reviewer spend per PR opened, by week"

PR https://github.com/slang-coworkers/nanoclaw/pull/1180, author **szihs**, base
**`nv-dashboard`**, head **`32690f3e1`**, merge-base `a6280de4a`, **5 files +741/−10**
(new `dashboard/unit-cost.ts` 174, `unit-cost.test.ts` 175, `unit-cost-panel.test.ts` 133,
`server.ts` +132/−10, `public/app.js` +127). **Already squash-merged `ffa3fa94d`** at review
time; all five blobs byte-identical head↔`nv-dashboard` tip ⇒ findings live. `ci` pending /
`label`✓ at my read. Comment **`5241221398`**.

**Routing: INLINE by Main**, ~31st instance of the standing rule
[[project_nanoclaw_pr874_webhook_route_approver]]. Direct sequel to
[[project_nanoclaw_1172_panel_tests_unreachable]] (same author, same file, same branch).

## Body verified

24/24 green at head. Both three-state tampers reproduce (`hasCost:false` and `prs:0` each
render words, not `$0`). Explicit group set is the right design. `prSource` counters, injected
clock, named `groupsMissing` all as described.

## 🔴1 The denominator is keyed on SESSION BIRTH, not PR open

`sessionIdMs` extracts epoch-ms from `sess-<ms>-`, which is when the **session** was created —
a fixer session is born at issue-routing, days-to-weeks before it opens a PR. The PR's comment
justifies this over `created_at` on timezone grounds (correct as far as it goes: naive
timestamp really is misread as local) — it settles PRECISION and never asks WHICH EVENT.

Measured vs `gh api pulls/N.created_at` over **every** unique prod mapping (n=280; slang#12007
404s):

| key | wrong ISO week |
|---|---|
| `sessionIdMs` (shipped) | **44/280 = 15.7%** |
| `created_at` (demoted fallback) | 14/280 = 5.0% |

⭐⭐⭐**The rejected fallback is 3× MORE ACCURATE than the primary** — a naive-timestamp read is
off by hours, a session-birth read by weeks. Worst: slang#12304 **44 days** early
(`2026-06-15` vs true `2026-07-27`), slang-rhi#812 34 d, slang#12336 33 d.
⚠️`fellBackToCreatedAt` reads **0** on live data (all 281 parse) ⇒ the counter that would
surface fallback use is **structurally silent**, and the worse key is in force 100% of the time.

## 🔴2 Denominator counts PRs from groups excluded from the numerator

Numerator = exactly 6 groups. Denominator = every prod `pr_session_mappings` row ∩ funnel, with
**no owner filter**. Joined against `agent_groups` over 281 prod mappings:

| PRs | owning group | in the six? |
|---|---|---|
| 244 | `slang-fixer` | yes |
| 19 | `slangpy-fixer` | yes |
| 1 | `slang-triager` | yes |
| **16** | **`Orchestrator`** (folder `main`) | **no** |
| **1** | **`slang-release-regression-check`** | **no** |

17/281 = 6%, **clustered not spread**: week `2026-07-13` is **31% foreign** (10 of 32).
⭐⭐**The decoy test guards the numerator against foreign spend; nothing guards the denominator
against foreign PRs — same error, other side of the divide.**

Combined effect vs *PRs the six actually opened, by TRUE open week*, over the 4 default weeks:

| week | panel denom | justified denom | true $100/PR renders as |
|---|---|---|---|
| 2026-07-13 | 32 | 24 | **$75 (−25%)** |
| 2026-07-20 | 26 | 25 | $96 (−4%) |
| 2026-07-27 | 33 | 34 | $103 (+3%) |
| 2026-08-03 | 24 | 27 | **$112 (+12%)** |

⇒ errors **don't cancel, aren't centred on zero**, and are the same order as the trend the panel
exists to show. The body's own "does not establish the figures match $270/$227/$161/$153" is
honest; this is the mechanism by which they'd disagree.

## 🟠 A zero-cost week renders the literal `$0` the docblock forbids

`costPerPr: hasCost && prs > 0 ? cost/prs : null` returns `0/n = 0` — a NUMBER. `hasCost` is
`costByWeek.has(week)`, true for a week whose entries price to nothing. Through the **shipped**
`unitCostHtml`, four shapes all render `>$0<` (control 120/2 → `$60`):
explicit `totalCost:0` · absent · `null` · non-numeric — the last three reachable because
`Number(d.totalCost) || 0` coerces while `costByWeek.set` still marks the week covered. Plus
`scanSkillTranscriptCosts` prices only `FALLBACK_PRICING` models (today only `claude-sonnet-5`)
⇒ a week of entirely-unpriced models yields dated zero-sum entries. Bounded 🟠: trend line does
NOT compound (`if (first > 0)` verified), no live zero-cost week found.

## 🟠 Panel unreachable unless `/api/funnel` 200 — producer is on another branch

`if (detail)` sits below two unconditional returns (`app.js:391`/`:396`). Stubbed DOM+fetch:
200→`/api/unit-cost?weeks=4` requested · 404→NO · 500→NO. `/api/funnel` 404s when
`reports/funnel.json` absent (`server.ts:5380`), whose producer `scripts/funnel.ts` is on
**`nv-main` only** — 0 hits on `nv-dashboard` and `nv-coworkers` (positive control:
`dashboard/server.ts` = 1 on nv-dashboard, 0 on the other two). **Identical to #1172 🟠4 on
`kbBox`, one PR later, one container lower.** Also: funnel's `orgAllowed` keeps only
`shader-slang/*` ⇒ 2 `slang-coworkers/*` prod mappings silently dropped (counter does report).

## 🟡 The decoy test asserts against the WRONG NAMESPACE

`isUnitCostGroup` receives `g.groupName` = `agent_groups.name` (via `nameMap`). The 8 decoys are
**folder** values. Real names: `dashboard_slang-fixer`→`Slang Fixer`, `generic-fixer`→
`Generic Fixer`, `legacy_slang-reviewer`→`Slang-Reviewer`, `main`→`Orchestrator`.
⭐⭐**7 of 8 don't end in `-fixer` once you use the field the code reads — the suffix rule would
have rejected them anyway. Exactly ONE (`slang-playground-fixer`) is a real hazard, and it's the
one whose folder and name coincide.** Design still right; the TEST overstates what it proves.
Also `groupsMatched` is `.sort()`ed while `groupsMissing` is declaration-order — two orderings,
one comment.

## ⛔ My own instrument failed toward voiding the measurement

⭐⭐⭐**`awk` here does NOT support `{n}` interval expressions** — `$5 !~ /^[0-9]{4}-/` matched
nothing and flagged **all 281** ground-truth rows malformed. A false positive over the ENTIRE
set, in the direction that would have discarded the whole population measurement. Caught by
absurdity (281/281 impossible when `head` shows valid dates), re-run with `grep -P` ⇒ true count
**1**. ✅Control: `echo 2026-08-08 | awk '$0 ~ /^[0-9]{4}-/'` prints nothing.
⇒ **verify the regex ENGINE supports the syntax before trusting a 100%-flag result; test the
pattern on a known-good row first.**

## Method

Detached worktree at `32690f3e1` in `/workspace/agent/wt-1180` (`/workspace/extra/ephemeral` is
**read-only** — worktree creation fails there), `node_modules` symlinked from `nanoclaw-kb`,
every tamper restored + `git status` between probes, source ref re-verified unchanged after.
`findmnt` checked (ANCHOR A): my tree is `/dev/vda1[…/groups/main]`.

**RESUME** = szihs replies to `5241221398` or pushes a follow-up ⇒ re-measure both bucket keys
against `gh api pulls/N.created_at` over the full prod population (not a sample), re-join the
denominator against `agent_groups`, and re-probe the zero-cost render through the shipped
`unitCostHtml`. Both 🔴 need `funnel.json` rows to carry the PR's `created_at`; 🔴2 is one
`agent_group_id IN (...)` clause.

See also [[project_nanoclaw_1172_panel_tests_unreachable]],
[[project_nanoclaw_1150_ccusage_own_nvmain]],
[[feedback_a_closed_set_allowlist_is_the_wrong_shape]].
