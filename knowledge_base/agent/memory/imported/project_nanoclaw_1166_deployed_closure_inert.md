---
name: project_nanoclaw_1166_deployed_closure_inert
description: "slang-coworkers/nanoclaw#1166 docs — five 'Closed' findings inert in prod; reviewed INLINE post-merge (3m24s); scope-defining ref absent from repo, single-cause story contradicted by its own two absence probes, F08 marker belongs to #1096 not #1106"
metadata: 
  node_type: memory
  type: project
  originSessionId: d732ac72-be5c-4f1e-a342-367925118fad
---

**#1166** (2026-08-10 06:23:18Z, author szihs, branch `docs/nv-main/deployed-closure-verification` → `nv-main`,
1 file `docs/deployed-closure-verification-2026-08-10.md` **+144/-0**). `pr_ready_for_review` webhook carried the
generic post-#874 *"route to the project's `*-pr-approver`"* task string — **standing rule overrides, ~29th
instance: nanoclaw PRs are handled INLINE by Main**, no nanoclaw approver is wired and a slang/slangpy *compiler*
approver at a nanoclaw docs PR is nonsensical ([[project_nanoclaw_pr874_webhook_route_approver]]).
**MERGED 06:26:42Z — 3m24s after opening**, so the review is post-merge; CI green at `12f00d5e`
(`label`/`ci`/`guard`/`check` all success). Merge `0280ead6e` = `origin/nv-main` tip. Comment `5236795394`.

⚠️**Prod and lego are NOT on my edge** (ANCHOR C) — I verified only nv-main-side facts + the doc's internal
arithmetic. Both deployed HEADs confirmed absent from the shared clone: `git cat-file -t 40c519caa` / `40cff931`
→ *"not a valid object name"*, control `55bd2305d` → `commit`. Exactly as the doc says.

## What survived execution

⭐⭐**The marker-validation discipline is the doc's best part and it holds.** Every marker checked at its closure
commit's **parent** and merge: `diskCacheTtl` 0→1 · `run_step()` 0→4 · `def culprits_for` 0→1 · `def write_atomic`
0→1 · `approval-ledger/{capability,guard}.ts` absent→present · `check-release-age-policy.sh` absent→present ·
`quarantine` in `install-cli-tools.sh` 0→9 · **rejected** `countHumanReview` **1**→1 (genuinely pre-existed;
`git show 55bd2305d^:scripts/funnel-metrics.ts` has it). Merge window EXACT: six closures 13:19:35Z→14:19:08Z
(#1106 13:19:35, #1107 13:19:41, #1118 13:48:59, #1124 13:58:34, #1110 14:02:04, #1132 14:19:08). Migrations
934/935 both from #1110, names match, and 934 adds precisely the three named columns (`provenance` NOT NULL
DEFAULT `'legacy'`, `verdict_source`, `verdict_source_event_id`).

## 🔴 The scope-defining reference does not exist

`[OPUS_CLOSURE_AND_PROD_GO_NO_GO_2026-08-07.md](../OPUS_CLOSURE_AND_PROD_GO_NO_GO_2026-08-07.md)` resolves to
repo root; **0 of 1209 paths** at `12f00d5e` match `opus|go_no_go` (`truncated:false`; **control** — same query
finds the new doc, count 1). `git log --all -- '*OPUS_CLOSURE*'` → **0** commits, `'*GO_NO_GO*'` → 0
(**control** `docs/ON-CALL-RUNBOOK.md` → 8). ⇒ every label the doc is *about* (F01/F06/F07/F08/F10, the F04/F14
demotions, "residual P2") is defined ONLY in an absent file.

## 🔴 The single-cause story is contradicted by TWO of the doc's own absence probes

Verdict `inert-in-prod` is fine and **over-determined**; the *cause* is not. Two absence markers are for
**pre-fix** files that landed on nv-main BEFORE prod's stated HEAD date 2026-08-05 08:46Z:
`scripts/regression-quality.py` (#1078, **07:49:12Z**, doc: *"does not exist"*) and `scripts/kb-doctor.py`
(#1076, **07:48:05Z**, doc: *"absent"*) — both ~1 h OLDER than 08:46, and `git log --first-parent --name-status`
shows no delete on either path (only A then M at the closure). ⭐⭐⭐**The doc's own observations bound prod's
CONTENT to a 46-minute window that EXCLUDES its stated HEAD date by ~58 min:** 931 applied ⇒ ≥ #1075 07:02:07Z ·
932 never ran ⇒ < #1092 14:49:55Z · kb-doctor absent ⇒ < #1076 07:48:05Z (tightest) · rq absent ⇒ < #1078
07:49:12Z ⇒ **[07:02:07Z, 07:48:05Z)**. Reconciliation is already IN the doc one section away and unconnected:
prod HEAD is a **box-local commit absent from the shared clone**, so 08:46 dates a *commit* and `dist/index.js`
mtime dates a *build* — **neither dates the CONTENT**. Same defect the doc correctly flags for "119 behind is a
floor," pointed the other way. ⇒ "one deploy behind, ~29 h" UNDERSTATES it and the HEAD date is the wrong
instrument for the distance.

## 🟡 F08's label is defensible; the mechanism named for it is not

F08's marker is *"`scripts/funnel-metrics.ts` does not exist"* — but that file was **added by #1096**
(`a37447ae0`, merged 2026-08-06 **06:39:16Z**, ~22 h AFTER prod's HEAD date), not by #1106. Its absence proves
prod predates **#1096**, not #1106 ⇒ **does not discriminate the F08 fix**. Same class as the `countHumanReview`
catch, one step out: validated against its parent but not against *which finding it belongs to*. ⭐⭐**The
stronger claim was available**: prod-era `funnel.ts` (`nv-main@a5e5b487`) has **0** `feedbackRound` / **0**
`humanReview` / **0** `reviewers` / **0** `reviewCycles` and **does not import `funnel-metrics.js` at all**
(control at `55bd2305d`: 4/5/4/4 + the import at line 47) ⇒ the 06:09 `funnel.json` rewrite is not "pre-#1106
review-cost code still miscomputing" — **the pre-#1106 producer has no review-cost fields to compute.**
`inert-and-actively-miscomputing` is the right CLASS; the explaining sentence describes an absent mechanism.

## 🟡 The funnel-cron log probe used the wrong path

Doc: *"`~/.config/nanoclaw/funnel-cron.log` does not exist, so the 30-minute job's output is not retained."*
**Every** version of `funnel-cron.sh` on nv-main — prod-era included — sets `LOG="$REPO/logs/funnel-cron.log"`
→ `/home/ubuntu/slang-coworkers-prod/nanoclaw/logs/funnel-cron.log`. Nothing under `scripts/` writes a log to
`~/.config/nanoclaw/` (that path holds `gh-app-token.py` — understandable collision). ⇒ **an absence at the wrong
path is indistinguishable from a real one**; conclusion may be true, evidence isn't.

## 🟡 Two smaller

- **F06 row overreaches:** *"all 252 rows remain structurally unattributable"* is not shown by the missing
  column — 934 backfills every pre-existing row to `provenance='legacy'`, so those 252 would be `legacy` and
  filtered out **with** the migration applied too. The prose gets the narrower/correct version (filter cannot be
  operating ⇒ joins unfiltered); the table row overstates.
- **"`funnel-cron.sh` (Jul 26)":** `git log --all --after=2026-07-24 --before=2026-07-28` on that path → **0**
  commits; last pre-#1106 is `bbb98c60d` **2026-07-15**. Likely a checkout mtime — should say so.

## Method notes worth reusing

⭐⭐⭐**A doc's own absence probes are a DATABLE INTERVAL — cross the migration-applied floor against the
file-absent ceiling and the stated HEAD date has to fall inside it.** Here it didn't, and the contradiction came
free from facts the doc supplied. ⭐⭐**A marker validated against its parent can still belong to the WRONG
FINDING** — check provenance (which PR added it), not just parent-vs-merge. ⭐**`git rev-list -1 --before=<ts>
origin/nv-main`** gives the branch content an as-of-timestamp deploy *would* have had; grep the metric field
names at that commit vs the fix's merge for a discriminating control.

RESUME = szihs replies, or prod gets deployed and the probes re-run (doc's own suggested next step: ledger should
read `merged, not deployed` for all five rather than `Closed`).
