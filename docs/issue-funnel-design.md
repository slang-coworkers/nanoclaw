# Issue Funnel — design

Measure how issues move from "routed to an instance" through to "merged", per instance (prod / lego), so we can see where chains drop off and distinguish legitimate exits from real leaks.

Status: **built** (`scripts/funnel.ts` + dashboard Admin → Funnel panel). The original PR-spine design (below) is the *detail* layer; a per-issue **partition** (v2, see next section) is the headline.

## v2 — per-issue partition (the headline funnel)

The PR spine (below) starts at "Routed" and its denominator is *PRs in `pr_session_mappings`*. That can't answer **"of ALL issues filed, how many did the bot merge (a WIN), how many got partial work, how many were not-a-bug, and where did the rest go?"** — because it never sees issues the bot didn't open a PR for, and it over-counts the "no-PR" tail (issues already closed, resolved by a human PR, or whose bot PR isn't in our mapping table).

v2 adds an independent **per-issue pass** in `scripts/funnel.ts` that enumerates ALL issues filed in the window and partitions them into mutually-exclusive buckets.

**Window:** the PR-mapping era — `MIN(pr_session_mappings.created_at)` → now. (`issues?since=` is *updated*-time, so the pass also filters `created_at >= windowStart` client-side; a safe superset.)

**Denominator:** `actionable = filed − not_our_problem`. **Win-rate = bot_pr.merged ÷ actionable.**

**Buckets** (first match wins), per `TRACKED_REPOS` (slang, slangpy, slang-rhi):

| Bucket | Definition |
|--------|-----------|
| `not_our_problem` | `state_reason==='not_planned'` OR a not-a-bug label (`NOT_A_BUG_LABELS`: "Not a Slang Bug", duplicate, invalid, wontfix, question, by design, …). **Excluded from the denominator.** |
| `bot_pr` | A **nv-slang-bot**-authored PR is cross-referenced to the issue (via the issue *timeline*). Sub-classified by `classifyPrStage()`: `merged ★` / `shipped-draft` / `pr-ready` / `pr-open` / `pr-closed`+`superseded`. |
| `resolved_elsewhere` | Issue closed-completed, only **human** PR(s) linked (or no bot artifact at all). Neutral exit — not our win, not our failure. |
| `triage_only` | Bot left a comment but opened no PR. This is the corrected `engagedNoPr` residue (replaces the old log-derived `routedNoPr`). |
| `never_engaged` | No bot comment, no bot PR. Top-of-funnel leak. |

**Signals & traps that matter here:**
- "Bot PR" is detected from the **timeline cross-references**, not `pr_session_mappings` — this catches bot PRs linked to a *sibling* issue or whose body lacks `Fixes #N` (the old funnel's blind spot).
- The `/issues` endpoint mixes PRs into its output — drop items with a `pull_request` key.
- PR-author check uses `BOT_LOGIN` (`nv-slang-bot[bot]`).

**Weekly WIN trend:** issues are cohorted by the Monday of the week they were *filed*; per week we report `winRate = merged/actionable` and a **trailing 4-week rolling** win-rate, so the dashboard graph shows whether we're trending up or down. Emitted as `issuePartition.weekly[]`.

**Snapshot shape** (`reports/funnel.json`): adds `issuePartition: { window, counts, winRate, weekly[], issues[] }` and `engagedNoPr[]` alongside the existing `board`, `rows`, `routedWindowed`, `routedNoPr` (legacy, kept for back-compat).

**Dashboard** (`dashboard/public/app.js` `loadFunnel` → `funnelFlowHtml` + `funnelWeeklyTrendSvg`): renders the partition as flow stat-cards (Filed → Actionable → Bot PR → Merged → win-rate), a proportional stacked bar of where actionable issues go, and the weekly trend line with per-point rolling-% labels. The PR spine is collapsed into a `<details>`.

---

## Original PR-spine design (the detail layer)

Decisions locked: top-of-funnel = **Routed**; success = **split Shipped-draft vs Merged**.

## Why this shape (the two things that would make a naive funnel lie)

1. **Draft-by-design.** In this dev/A-B pipeline a draft PR parked at the human merge gate is the *intended* terminal, not a failure. A live sample showed ~13 draft-open : 1 merged. A "routed → merged" funnel reads ~3% and looks broken. **Split the terminal**: *Shipped (draft, review-ready)* is the realistic bar; *Merged* is the stretch.
2. **Not every drop is a leak.** Triaged→wontfix/dup/out-of-scope and "a different PR merged" (superseded) are *clean exits*. Report them as labelled **side-exits**, not as funnel attrition, or the spine numbers get misread.

## Stages (spine)

| # | Stage | Definition | Source | Join key |
|---|---|---|---|---|
| 1 | **Routed** | issue dispatched to an instance | prod `dev-routed issue to peer` log **+** lego `messages_in` (kind=webhook, `gh-issue-` thread) | (repo, issue#) |
| 2 | **Triaged** | triage report produced | **GitHub: nv-slang-bot triage comment** on the issue | (repo, issue#) |
| 3 | **Fix attempted** | fixer branch exists | `gh pr list --head fix/issue-<n> --state all` | branch → issue# |
| 4 | **PR opened** | mapping row + PR exists | `pr_session_mappings` ⋈ `gh pr view` | (repo, pr#) ⋈ PR-body `Fixes #N` |
| 5 | **PR ready-for-review** | out of draft | `gh pr view --json isDraft` | pr# |
| 6 | **CI green** | checks pass | `gh pr checks --json bucket` | pr# |
| 7a | **Shipped (draft)** | review-ready, parked at human gate | stage 5/6 reached, not merged | pr# |
| 7b | **Merged** | terminal success | `gh pr view --json merged` | pr# |

Dimension every stage by **instance** (prod vs lego) — prod processes some issues itself and forwards others; PR ownership splits ~33 lego / 26 prod via `pr_session_mappings.owner_instance`. A combined funnel hides where drop-off happens.

## Side-exits (reported next to the spine, not as attrition)

- **Closed-legit** — issue closed `not_planned` / dup / out-of-scope / maintainer-handled after triage. `gh issue view --json state,stateReason`.
- **Superseded** — our PR closed un-merged while a *different* PR merged (`closedByPullRequestsReferences` ≠ our PR). The #11410 postmortem case.
- **Stuck/silent** — chain with no progress and no GitHub artifact (the supervisor's leak signal).

## Authoritative keys & joins

- Everything keys on **(repo, issue#)**. The PR↔issue link is the **PR body `Fixes/Closes #N`**, NOT `thread_id`. PR↔session is `pr_session_mappings`.
- "Routed" is **window-bound** (the prod log rotates, ~6 days) — label it as such. For all-time, `pr_session_mappings` (persists in `v2.db`) anchors stages 4–7; GitHub anchors 2 and the side-exits.

## Traps (each cost time this session — bake into the query)

1. **`thread_id` ≠ issue** — a reused session threaded `gh-issue-…-N` can ship issue M's PR. Attribute via `pr_session_mappings` + PR body. [[project_container_pr_lookup]]
2. **Straggler undercount** — ~5 routed issues never got a `gh-issue-` session but *were* triaged on GitHub. Measure stage 2 from **GitHub comments**, not session existence. [[project_backfill_thread_rejoin]]
3. **gh rate limit** — authenticate (`GH_TOKEN`) and cache; unauthenticated CI/loop fetches 403 on the shared runner IP. [[project_dashboard_hidechatter_scope]] sibling lesson.
4. **Log ANSI** — strip `\x1b\[[0-9;]*m` before grepping the dev-routed lines (raw counts are inflated/garbled otherwise).
5. **Container can't read v2.db** — if this ever runs inside a coworker, `pr_session_mappings` is host-only; resolve via `gh`. [[project_container_pr_lookup]]

## Build plan (when greenlit)

**Phase 1 — one-shot `scripts/funnel.ts`** (host, has v2.db + gh via OneCLI):
1. Build the routed-set: parse prod `dev-routed issue to peer` (ANSI-stripped, distinct repo#issue) + lego `messages_in` webhook rows. Tag instance.
2. For each (repo, issue#): fetch issue state + bot-triage-comment presence (GitHub), then `gh pr list --head fix/issue-<n>` → PR#, then `gh pr view/checks` for draft/CI/merged. Batch + cache; respect rate limit.
3. Resolve PR→issue via PR-body `Fixes #N`; flag mis-threaded.
4. Emit: per-instance stage counts + conversion %, with the 3 side-exits broken out, and the 7a/7b split. Render as a table (and optional JSON).

**Phase 2 — standing (near-free):** `/supervise-issues` already walks every in-flight chain and resolves PRs via `gh` each tick. Have it write a **funnel snapshot** into `supervisor-state.json`; the dashboard renders it. No extra query cost beyond what the supervisor already pays.

## Open questions for build time

- Routed top-of-funnel is window-bound; do we want a durable shadow count (issues the bot ever triaged) as a secondary line?
- Where does the funnel render — CLI table, a `reports/` file, or a dashboard panel?
