---
name: project_nanoclaw_1104_dashboard_denominator_panels
description: "nanoclaw#1104 dashboard review-cost + regression-quality panels — reviewed INLINE (~27th routing instance); my headline (hidden unknownPrs) was fixed by a mid-review synchronize AND answered a 5-point review with ZERO PR footprint; reframed as verification. OPEN/green at aa7715ae."
metadata: 
  node_type: memory
  type: project
  originSessionId: e5a24ae7-c55e-4c72-b210-2090d1160367
---

# nanoclaw#1104 — dashboard denominator panels (szihs, base `nv-dashboard`)

Comment `5204542503`. Reviewed **INLINE by Main** (~27th instance of the standing rule: nanoclaw
PRs are never routed to a `*-pr-approver`; verb-split write path — `gh api .../issues/N/comments
-X POST` works, `gh pr review`/`gh pr comment` denied).

## Verdict: no blockers at head `aa7715ae` (OPEN, `ci` green, +176/−1, 2 files)

Display-only PR: `reviewCyclesHtml` + `regressionQualityHtml` in `dashboard/public/app.js`, plus
`GET /api/regression-quality` in `dashboard/server.ts`.

## 🔴 My headline finding — real, and EVAPORATED by a mid-review `synchronize`

At first head `21b77ecf`, **`unknownPrs` had ZERO consumers anywhere in the tree** (0 hits outside
`funnel-metrics.ts`, against a producer that populates it and `funnel-metrics.test.ts:66` that
asserts it). Measured through the real producer:

| input | producer | rendered at `21b77ecf` |
|---|---|---|
| 10 bot PRs, all review lookups failed | `unknownPrs:10, coveragePct:null` | `no data / 0 / — / 0` |
| **1 reviewed + 9 failed** | `reviewedPrs:1, unknownPrs:9, coveragePct:100` | **`5 / 1 / 100% / 0`** |

⭐⭐⭐**The mixed row was the sharp one, not the all-failed row** — coverage **100% off a single PR
while nine lookups failed**, and the `<50%` warning colour is **unreachable by construction**
because `coveragePct`'s denominator is `reviewed + unreviewed`, which excludes unknowns. A panel
whose entire thesis is "never show a headline without its denominator" was hiding its own
denominator's failure mode one level up.

Fixed at `aa7715ae`: separate warning-coloured `unknown` column, caption says a high coverage
beside a high unknown is not reassurance. Re-measured with a firing control (normal input still
renders `3 / 2 / 100%`).

## ⛔⭐⭐⭐ The real lesson: the author answered a 5-point review with ZERO PR FOOTPRINT

`szihs` comment `5204456725` ("All five addressed in `aa7715ae7`") enumerates five findings —
including my P1 verbatim — but the PR carries **0 reviews, 0 inline comments, and a timeline of
`committed/committed/commented`**. The review it answers is not on the PR at any surface I can
query. ⇒ ⭐⭐⭐**A "responding to review" comment is EVIDENCE OF A REVIEW I CANNOT SEE, and
publishing my own overlapping findings after it would have read as duplicated work I hadn't
credited.** Checked `pulls/N/reviews`, `pulls/N/comments`, `issues/N/comments`, `issues/N/timeline`,
and `ncl sessions list` (one session on `gh-pr-slang-coworkers/nanoclaw-1104`, mine) — all clean.

⇒ **Reframed the comment as an explicit verification pass on the fixes**, leading with "I arrived
after your push and landed on the same P1, so this is verification rather than another review."
⭐⭐**Overlap discovered BEFORE posting is cheap to reframe; discovered after, it costs credibility.
Read the newest comment on the PR immediately before drafting, not only at fetch time.**

## Fixes verified by measurement (not by reading the commit message)

- **`colspan` 4→5** — real: header grew to six columns, null-class branch under-spanned.
- **`snapshotMtime`** from `statSync(p).mtime` — collision-free (**0** occurrences in
  `regression-quality.py`, so no producer key shadowed); swept ages: `just now`/`20h ago`/
  `37h ago (stale)`/`2d ago (stale)`/`30d ago (stale)`/`age unknown`. `>36h` cap correctly
  tolerates one missed daily run, not two.
- **De-nesting into `rqBox`** — author's retraction correct, plus a benefit they did NOT claim:
  `createElement`+`appendChild` avoids `innerHTML +=` reserialising the sibling table, which would
  have destroyed the `refresh-botc` listener at `app.js:449`.
- **Sampling frame** "Verity-decided merged PRs" matches the producer (`approverDecisions`, nulls
  from the `pulls/{n}` enrich loop `funnel.ts:378-393`).

## ⭐⭐ The one number I added that the author didn't have

Their census (5 `CHANGES_REQUESTED` vs 1,178 `COMMENTED`) implies the DOMINANT real shape is
*reviewed by a human, zero change-requests*. Ran 20 such PRs through the real producer:
`{reviewedPrs:20, unknownPrs:0, meanRounds:0, coveragePct:100}` → renders **`0` bolded at 100%
coverage** (a real zero, since `meanRounds` is `null` only when `reviewedPrs===0`). ⇒ "we reviewed
everything and it needed no changes" is indistinguishable from "we counted the wrong review state",
**on the common case rather than an edge case** — which raises the value of the producer-side fix
they deferred. ⭐⭐**Agreeing with a deferral is more useful when you quantify what the deferral
costs.**

## Agreed with the author against my own instinct

**P1.3 cohort mismatch** (numerator by issue `created_at`, denominator by PR `merged_at`) —
they refused to relabel the axis, fixing it at the producer instead. ⭐⭐**Right call: relabelling
makes the display LOOK consistent while preserving the error, and a plausible-looking rate is
harder to catch later than an obviously-mislabelled one.**

## Checked clean (recorded so it isn't re-litigated)

Producer/route path agreement (`funnel-cron.sh:49` writes exactly what the route reads) ·
**producers correctly live on `nv-main` and reach this branch through the overlay merge at
`ci.yml:75` — their ABSENCE from `nv-dashboard` and from this head is the expected shape, NOT a
missing dependency** (⭐⭐ nearly filed as a 🔴 before checking the overlay model) ·
`"—"` (no denominator) vs `"0.0"` (real zero) render as distinct glyphs, which matters because the
two key spaces genuinely diverge · `repo`/`label` escaped · `node --check` exit 0.

## 🟡 Non-blocking notes posted

1. **No test — and the mirrored precedent has the same hole**: `/api/bot-contributions` has **0**
   occurrences in the 3,566-line `dashboard/server.test.ts`. Consistent, not careless; declining to
   ship tests they can't execute (`rolldown-binding.darwin-arm64.node` won't load) is right.
2. **`reviewCyclesHtml` carries no age of its own** — inherits `snap.generatedAt`, which renders via
   `formatTime` at `app.js:398` with **no staleness threshold, no warning colour**, physically
   separated from the table it qualifies. The two panels now disagree about how loudly a dead cron
   announces itself — same class of problem just fixed one panel over.
3. Cosmetic/unreachable: malformed `snapshotMtime` → `NaNd ago` instead of `age unknown` (empty
   string *does* fall back). Route generates the field, so nothing produces it today.

## Method note

⭐⭐⭐**Every finding came from RUNNING the real producer into the real renderer, never from
reading** — imported `nv-main:scripts/funnel-metrics.ts` via `node --experimental-strip-types`,
extracted each renderer VERBATIM from the head blob with `new Function`, and paired every probe
with a control that could return the other answer. Reading the diff finds none of it. Fourth
consecutive nanoclaw PR where this is true (cf. #1068, #1076, #1078).

⚠️`git worktree` at `/tmp/wt1104`; `baseRefOid` happened to equal the true `git merge-base` here
(verified — two-dot and three-dot diffs both 2 files), unlike #1103.

## 🔄 3rd head `b8f83c94` — "consume the corrected metric schemas (#1106, #1107)", +229/−1, ci green

Comment `5205073657`. The two producer fixes I flagged became sibling PRs — **both still OPEN**
(`#1106` funnel feedback-session rounds, base `nv-main`, head `b6451b86`; `#1107` regression
fail-closed + culprit-merge-month cohort, head `31d960da`). Every consumed field verified present in
the producer PRs by line: `meanFeedbackRounds`:199, `meanChangesRequested`:201, `roundDefinition`:229,
`sessionGapMinutes`:230; `cohort_*`:368-369, `rate_*_per_100`:371-372, `complete`:278, `errors`:117.
⭐⭐**Their `mean rounds` + `of which CR` split is BETTER than my suggestion** — the strict subset stays
visible without becoming the quotable number.

### 🔴 A. Merge-order hazard: if #1104 lands before #1107, the regression table renders EMPTY under a live coverage headline

Piped the **current `nv-main` producer** (what the host cron runs NOW) into this head's renderer:
coverage callout + "numerator and denominator describe the same population" caption both render
authoritatively above **zero rows**. ⭐⭐⭐**The `complete === false` fail-closed guard CANNOT catch it —
the old producer never writes a `complete` key, so `undefined === false` is false and execution falls
through to the cohort read**; `months` = union of three absent maps = `[]`. Reads as "no regressions
this period", not "schema mismatch". Positive control: `#1107`'s shape → 2 rows + rates + mixed note;
`complete:false` → fail-closed branch. ⇒ the renderer is right, but only AFTER its producers land.

⭐⭐⭐**`reviewCyclesHtml` degrades HONESTLY on the same mismatch and that contrast is the lesson**:
it reads `meanFeedbackRounds`→`no data` AND `roundDefinition !== 'feedback-session'` → *"Round
definition unavailable from this snapshot."* — an explicit legible statement that the schema didn't
match. The regression panel has no equivalent sentinel, so the identical mismatch is SILENT there.
⇒ **fix = make the missing-cohort state explicit (as the round rule already does), so merge order
stops mattering in either direction.**

⚠️**The producers do NOT reach the dashboard via the `ci.yml` overlay merge — that composes branches
for TESTING only.** `funnel-cron.sh:12` runs from a deployed checkout at
`/home/ubuntu/slang-coworkers-prod/nanoclaw`, so **what is on disk when the cron fires decides the
schema, independent of CI going green here.** ⭐⭐*Checking the overlay merge answers "does it build",
never "what will run".*

### 🔴 B. The new fail-closed branch renders `[object Object]`, losing the only diagnostic it exists to show

`.map((e) => esc(String(e)))` assumes strings; `#1107` `regression-quality.py:121` appends
`{"what":…, "detail":…}` ⇒ `String(obj)` = `"[object Object]"`. Measured on the exact producer shape:
`[object Object] · [object Object]`; string control → readable; absent control → header only. The
banner text still lands so a human knows *something* broke, but `what`/`detail` is the whole reason to
publish an `errors` list over a bare boolean, and this is its only surface.

⭐⭐⭐**A and B are the two sides of ONE coupling and are reachable in OPPOSITE orders** — B only once
`#1107` merges, A only while it hasn't. ⇒ **argued for making the schema-mismatch state explicit
rather than hand-managing merge order.**

✅Verified good at this head: `colspan` 5→6 tracks the header (3rd lockstep move, right each time) ·
**rendering the producer's own `roundDefinition` instead of a hardcoded caption directly prevents the
drift that made "mean CR rounds" wrong two heads ago** · `num()` keeps a missing rate distinct from a
real `0.0` · cohort-key union means a mixed-only month still appears · mixed excluded from both rates
and stated in words · `node --check` exit 0 · escaping intact.

⚠️`gh pr view` hit a **502 on the GraphQL endpoint** during the pre-post state recheck — REST
(`gh api repos/…/pulls/1104`) answered fine. ⭐**A 502 from one gh transport is not a state answer;
fall back to REST rather than treating it as unknown.**

RESUME = author replies, or a 4th head. **Author ships responsive commits within MINUTES on this
series — re-fetch head SHA and re-measure BOTH findings with their controls before any follow-up.**
Unmerged; maintainer owns merge. Open asks = explicit missing-cohort sentinel, `errors[]` object
rendering, `reviewCycles` snapshot-age parity (untouched across all 3 heads).
