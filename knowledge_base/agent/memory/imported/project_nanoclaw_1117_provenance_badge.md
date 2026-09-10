---
name: project_nanoclaw_1117_provenance_badge
description: "nanoclaw#1117 dashboard provenance badge — reviewed INLINE (~28th routing instance), MERGED mid-review at same head (blob 932d779a by hash). 2 real findings, both found by EXECUTING the panel against the merged producer's exact object: dead Array.isArray branch, and no zero-guard at the 934 cutover. Comment 5205515496."
metadata:
  node_type: memory
  type: project
  originSessionId: 6ad20816-a26f-4842-bae5-05ae5f6f77c3
---

# nanoclaw#1117 — "say whether the approver ledger is provenance-filtered" (szihs, base `nv-dashboard`)

Comment `5205515496`. Reviewed **INLINE by Main** (~28th instance of the standing rule: nanoclaw
PRs never route to a `*-pr-approver`; verb-split write path — `gh api .../issues/N/comments -X POST`
works). Sibling of [[project_nanoclaw_1104_dashboard_denominator_panels]] (same author, same panel
family, same "never let a narrowed population render as a clean one" thesis).

**MERGED mid-review** (`51d532c8`, ~6 min after opening) at the **same head** I was reading ⇒
merged blob == reviewed blob **BY HASH** (`932d779a48d5064a6dd3d4f658e64a413421a714`), parents
`(571597cf, 1e444f01)` = true merge. Unlike prior races nothing had to be re-measured — but the
hash check is what established that, not the unchanged `headRefOid`.

## ⭐⭐⭐ The method that produced both real findings: EXECUTE the consumer against the PRODUCER'S EXACT OBJECT

Extracted `esc` + `funnelApproverPanel` verbatim from the merged blob by brace-matching, stubbed
only `formatTime` (a table cell the badge never touches), and fed the literal object
`scripts/funnel.ts:790` emits. **Reading the diff would have found neither finding** — both are
type/population facts that live at the producer-consumer seam, invisible in a one-file diff.

⚠️Instrument note: the extraction needed 3 iterations (`formatTime` → `NANOCLAW_TZ` → `_tzSameDay`
all undefined). ⭐**A browser script's transitive globals are the cost of this technique; stub the
LEAF you don't care about rather than harvesting the chain.**

## 🔴 F1 — the `(sources)` parenthetical is dead against its only producer

Consumer tests `Array.isArray(ledger.trustedProvenance)`; #1115 (MERGED, `4a35e149`,
`funnel.ts:790`) emits it as a **string** (`const TRUSTED_PROVENANCE = 'agent_verified'`).
Measured, with the array case as a firing positive control:

| ledger | renders |
|---|---|
| `{filtered:true, trusted:'agent_verified'}` (real producer) | `· trusted only` — **no sources** |
| `{filtered:true, trusted:['agent_verified']}` (control) | `· trusted only (agent_verified)` |
| `{filtered:false, trusted:null}` | `· UNFILTERED …` (warn) |
| absent | `· provenance unknown` |

⭐⭐**Three of four states work — which is exactly why a diff read passes it.** The escaping is
also correct (`['<script>']` → `(&lt;script&gt;)`); `esc` is fine, it just never gets called.

## 🔴 F2 — filtered-to-zero has no guard, and the cutover is the guaranteed first state

Migration 934 backfills **every** pre-existing row to `provenance='legacy'`
(`ADD COLUMN provenance TEXT NOT NULL DEFAULT 'legacy'`; its own doc: legacy rows "stop counting as
calibration evidence") ⇒ trusted population is 0 the instant it runs. Measured:

| | header | colour |
|---|---|---|
| T0 pre-934 | `1204 PRs decided · UNFILTERED …` | warn |
| **T1 post-934** | **`0 PRs decided · trusted only`** | **muted** |
| T2 later | `7 PRs decided · trusted only` | muted |

Body at T1: `No approver decisions recorded yet.` — with 1,204 rows in the table. ⭐⭐⭐**A panel
whose entire thesis is "a narrowed population must not render as a clean one" renders its own
narrowing as clean, in the one state its own migration guarantees.** Same shape as #1104's hidden
`unknownPrs`; the sibling precedent (`rq.complete === false`, `app.js:675`) already does it right.

## 🟡 F3–F5

- **F3** `provenanceFiltered:false` also fires for **no ledger table at all** (#1115's
  `columns.length===0` branch returns without setting it, init value `false`) ⇒ a fresh install
  renders `0 PRs decided · UNFILTERED — includes rows of unknown origin`. Producer distinguishes
  the two in its own `console.error`s but collapses them into one boolean on the wire ⇒ only
  fixable in `funnel.ts`.
- **F4** #1115 filters **both** maps; the per-issue Approver cell (`app.js:947-951`, from
  `approverByPr`, `funnel.ts:475`) renders a filtered-out decision as an **empty cell** —
  which `app.js:929-930` documents to mean "no approver ran". Same ambiguity, one table lower,
  unbadged.
- **F5** No test — but `dashboard/approval-card.test.ts` covers `app.js` with `readFileSync` +
  source assertions and imports only `fs`/`path`/`url`/`vitest`, **no rolldown**, so the author's
  (honest, correctly-flagged) `server.test.ts` blocker doesn't apply to the precedent that fits.

## ✅ Author claims verified, not taken

`node --check` exit 0 (re-ran). Prettier scope claim is **right**: `package.json:18` gates
`"src/**/*.ts"` only ⇒ `dashboard/` genuinely out of the gate. `ci`+`label` green.
⚠️Their `tsc --noEmit` claim is *true but vacuous for this PR*: `tsconfig.json` has
`include: ["src/**/*"]` and no `allowJs`/`checkJs` ⇒ **the one changed file is not in the tsc
program at all.** ⭐⭐**A green checker that does not include the changed file is not evidence
about the change** — and would have caught F1 if it did.

## Cross-branch fact worth keeping

Producer (`scripts/funnel.ts`) is owned by **`nv-main`**; consumer (`dashboard/**`) by
**`nv-dashboard`** (`.github/nv-path-guard/*.txt`). They only ever coexist via `ci.yml`'s
composed-state merge (`branches: [main, nv-main, nv-dashboard, …]`, owned-path conflicts resolve to
`origin/nv-main`). ⇒ **A producer/consumer contract in this fork spans two branches and neither
PR's diff shows both halves** — fetch the sibling's blob before believing a field arrives.

RESUME = szihs replies; F1/F2/F4 offered as one follow-up to `nv-dashboard`, F3's producer half as
a separate `nv-main` PR. Regressions LIVE on `nv-dashboard`.
