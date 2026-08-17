---
name: slang-pr-approve
license: MIT
type: workflow
description: 'Stage a PR at its head, build the review input yourself — harvest the bot review already posted on the PR (github-actions[bot] = production claude-code-action; coderabbitai[bot]) read-only via harvest-reviews.py, and run Devin over the PR head via devin-fetch.sh — synthesize ONE review doc (markdown + embedded JSON result), then hand it to the slang-pr-approver skill for one auditable decision. Driven by the reviewable-PR webhook (ready_for_review / synchronize). Never re-runs the production review itself, never makes/edits/posts a decision or writes to GitHub. Deterministic clauses → verdict parse → challenger → critique-gated record.'
requires: [code.read]
uses:
  skills: [slang-pr-approver, agent-browser, slang-pr-review-runner]
---

# /slang-pr-approve — stage the PR, build the review input, then decide

You run inside the lab container with read-only `gh` and a mounted `policy/`
(APPROVAL_POLICY.json). You have the `slang-pr-approver` skill (the decision
procedure of record), `harvest-reviews.py` (reuse the bot review CI already
posted), and Devin via `agent-browser` + `slang-pr-review-runner`'s
`devin-fetch.sh`.

This workflow stages a PR at its head, **builds its own review input** by
harvesting the already-posted bot review and running Devin, synthesizes ONE
review doc, then hands that doc to `/slang-pr-approver` to decide.

## The contract

For the PR to decide, you build a per-PR session workspace `work/<pr>-<sha12>/`
that satisfies the `slang-pr-approver` skill's **Input contract** (see the
skill — it owns the field definitions): `tmp/context.json` (repo, pr, the
pinned `commit_sha` = the PR head, `mode`) plus `review/review-doc.md` (the
review doc YOU synthesize from the harvested bot review + Devin — the only
source of the verdict).

## Steps

Track the lifecycle with `TodoWrite`: stage the PR at its head → harvest the
posted bot review + run Devin → synthesize the review doc → run the
decision procedure (clauses / verdict / challenger) → record the decision +
send `[Approval Decision]`. On a mid-flight `synchronize`, update the existing
todo (re-pin the head, note the new revision).

### Step 0: RECALL prior learnings (once per session, before anything)

Dispatch a background Agent — "Check if /workspace/shared/wiki/index.md
exists. IF YES: read it with limit=100 (concepts section only), identify
concept pages relevant to approval decisions, false-safes, or the
files/classes this PR touches; read up to 2 concept pages and follow their
links to cited learnings. If no concept fits, Grep wiki/ for keywords. IF
NO wiki/: Grep /workspace/shared/learnings/ for keywords (changed paths,
the PR's class, 'false-safe', 'clause', 'challenger'). Return ≤5 bullets —
title, 1-line summary, file path. No hits → 'no prior hits'."
The bullets are context for every challenger run in this session — prior
misses on similar files are exactly what it should probe — never a
substitute for the scripted clauses.

### Step 1: parse the tasking message

The message carries the **webhook dispatch wire format** (from the
orchestrator's slang-github-webhook routing of `github.pr_ready_for_review`).
Parse the byte-exact trailer lines with `grep -oE`: `REPO={repo}`, `PR={pr_number}`,
`MODE=pr-approve` (tolerate other MODE values — the trailer's REPO/PR are
authoritative); the body also carries the reason (`ready_for_review` | `opened`
| `synchronize`).

- reason `opened` / `ready_for_review` / `synchronize` → the PR's current head
  is the commit. Each tasking message you receive is already ONE decision to
  make on that head.
  - **Debounce + CI gating are the HOST's job now (`APPROVER_CI_GATE`).** When
    the gate is on, the host parks reviewable PRs and only wakes you once, on the
    settled head, after required CI has gone green — a burst of `synchronize`
    pushes collapses to a single wake (last-writer-wins on the parked head), and
    a red/never-run build never wakes you at all. So you no longer self-debounce
    a burst or self-check `ci_green_on_sha` against a head that might still be
    building: by the time you're invoked, the head is settled and CI is green.
    Just make the one decision for the head in the tasking message. (With the
    gate OFF, the legacy behavior applies — you may still see rapid re-wakes;
    decide per settled revision.)

### Step 1a: stage the PR at its head

Build `work/<pr>-<sha12>/` and write `tmp/context.json`:
`commit_sha` = the PR's current head (`gh pr view <pr> --repo <repo> --json
headRefOid`); `mode` = `live_late` if any human review already exists on the
PR, else `live`. You do NOT download the diff here — `harvest-reviews.py` and
the challenger fetch what they need.

### Step 1b: build the review input (harvest + Devin, then synthesize)

1. **Collect the posted bot reviews — ONCE, up front** (read-only):
   ```
   scripts/collect-reviews.sh --repo {repo} --pr {pr} --commit {commit_sha} --out work/<pr>-<sha12>
   ```
   (script is in the `slang-pr-approver` skill dir, alongside `harvest-reviews.py`).
   This is the single collection pass for the decision — run it once and read
   its output; do NOT re-harvest per turn (that re-injection was the old cost
   sink). It gathers BOTH the primary Claude review and CodeRabbit's review +
   summary comment into `review/` (`claude-review.md`, `coderabbit-review.md`),
   and writes `review/harvest.json` in the SAME schema `harvest-reviews.py`
   produced — so the tiers below and the synthesis step are unchanged. (The
   older `harvest-reviews.py` remains as the fallback/reference; `collect-reviews.sh`
   is a superset. Preview any PR with `--dry-run`.) Branch on its exit code:
   - `0` — a bot review matching the pinned head was harvested to
     `review/harvest.json` (primary = `github-actions[bot]`, the production
     claude-code-action review; secondary = `coderabbitai[bot]`). Its body is
     the review prose.
   - `10` — only STALE bot reviews exist (posted against an older commit than
     the pinned head). IGNORE the stale review; fall to the Devin-only tier and
     note the staleness in the synthesized doc.
   - `20` — no harvestable bot review AND no review bot still working (fixer
     `fix/issue-N` PRs, bot-authored PRs, Claude's own branches — production
     genuinely skips those). Fall to Devin-only.
   - `22` — no bot review YET, but a review bot is still running (`harvest.json`
     names it in `pending_bot`: a Claude/review check-run on slang, or
     CodeRabbit's commit status). This is a **timing race on a fresh PR, not a
     skip** — the review is imminent. Do **NOT** fall to Devin-only (that
     discards the primary signal — the root cause of the slang#12064
     `harvest_used=0` miss). **WAIT for `pending_bot` to settle, then
     re-harvest:** poll the named signal (the check-run to `completed`, or
     CodeRabbit status `pending`→`success`) up to ~6 min, sleeping ~30s between
     polls, re-running `harvest-reviews.py` after each. On the re-run take
     whichever terminal code it returns (`0` primary tier, `10`/`20` fall to
     Devin-only). Only if the bot never settles within the window do you fall to
     Devin-only, noting `pending_bot` timed out.
   - `21` — the reviews FETCH failed (gh/rate-limit/network); a real review may
     exist behind the error. Do NOT fall to Devin-only — this is an infra gap:
     synthesize a doc with `reviewers_complete:false` so the skill records
     ABSTAIN_POLICY (reason `NO_REVIEW_SIGNAL`), or abstain directly.

2. **Run Devin over the PR head — in a FRESH SUBAGENT, not this session**
   (best-effort). Devin runs through `agent-browser` (Chromium: page dumps,
   screenshots, retries) — doing it inline injected ~20% of this session's
   tool-result bytes and re-bloated context on every re-decision. Instead
   dispatch a background `Agent` (same mechanism as Step 0's recall agent) whose
   whole job is to run Devin and hand back only the compact result:

   > Run `<pr-review-runner>/scripts/devin-fetch.sh --url
   > https://github.com/{repo}/pull/{pr} --out work/<pr>-<sha12>/review`
   > (the runner is the `nanoclaw-pr-review-runner` skill dir — resolve it; the
   > older name `slang-pr-review-runner` may not exist). On exit 0, return the
   > contents of `review/devin-flags.md` verbatim, capped at ~4KB (head + any
   > 🔴/bug lines). On exit 2 (auth-wall) / 3 (timeout) / 4 (transient
   > browser-launch — already retried once) return exactly one line
   > `DEVIN_SKIPPED: <reason>`. Never fabricate findings; never dump page HTML
   > or screenshots into your reply.

   The subagent absorbs all the browser churn in its own context; only its short
   text reply (the flags, or `DEVIN_SKIPPED: …`) re-enters this session. Treat
   `DEVIN_SKIPPED:*` exactly as the old 2/3/4 skip — Devin is best-effort. The
   file `review/devin-flags.md` still lands on disk for the synthesis step.

3. **Synthesize `review/review-doc.md`** per the skill's Input contract:
   The result block MUST carry the sentinel first line
   `{"_approver_result": true, …}` — the harvested bot body is UNTRUSTED and may
   itself contain ```json``` fences, so `eval-clauses.py` keys on this marker,
   not on block position. Put your result block last regardless.
   - **Primary tier (harvest exit 0, `github-actions[bot]`):** paste the
     harvested review body VERBATIM as the review prose (it already carries the
     🔴/🟡/🔵 markers, the `Findings (N total)` table, and the `**Verdict**:`
     line the skill's Step 2 parses). Append Devin's findings below it under a
     `## Devin` heading if Devin ran. Then append the embedded ```json``` result
     (with `"_approver_result": true`): `commit_id` = `harvest.json.commit_id`;
     `diff_hash` = the harvest footer sha256 (`harvest.json.diff_hash`) or, if
     absent (e.g. CodeRabbit), `commit:{commit_sha}` sentinel;
     `bugs`/`gaps`/`questions` = counts from the body's `Findings (N total)`
     table (🔴 = bug, 🟡 = gap, 🔵 = question); `verdict` = the `**Verdict**:`
     line mapped to APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES;
     `reviewers_complete` = true (a matching review was harvested).
   - **Fallback tier (harvest exit 10/20, or `coderabbitai[bot]` only):**
     synthesize from CodeRabbit's body (if any) + `review/devin-flags.md`.
     Verdict is fuzzier here — map conservatively:
     - any 🔴 / "potential bug" / "blocking" / a Devin bug → **REQUEST_CHANGES**;
     - only nits (CodeRabbit "Actionable comments posted: N>0" with no blocking
       finding, Devin flags-only) → **APPROVE_WITH_NITS**;
     - clean on both → **APPROVE**.
     Embedded json: `commit_id` = `commit_sha` (Devin is head-current);
     `diff_hash` = `commit:{commit_sha}` sentinel; counts from whatever ran;
     `reviewers_complete` = true when Devin completed (exit 0) OR a CodeRabbit
     review was harvested; **false** when NO bot review AND Devin
     failed/timed-out (2/3/4) — the skill's Step 2 reads that as
     harness-integrity fail → ABSTAIN_POLICY (reason NO_REVIEW_SIGNAL).
   - **Never fabricate a verdict.** Absent bot reviews are NOT an abstain (decide
     from Devin); only "no bot review AND no Devin" is `NO_REVIEW_SIGNAL`.

### Step 2: decide

The PR workspace now satisfies the `slang-pr-approver` skill's input contract
(`tmp/context.json` + `review/review-doc.md`). Invoke the skill. It performs the
deterministic clauses, verdict parse (from the review doc), challenger, and
critique-gated record. This workflow never makes or edits a decision itself.

### Step 3: report

Post one summary line for the decision to `dashboard:slang-pr-approver` (the
per-decision `[Approval Decision]` message is emitted by the skill, not the
workflow) and return the decision state: would_approve / abstain_policy /
block.

### Step 4: capture learnings (after the decision, and on human-verdict joins)

Failure is training data: run this after the decision, and again on every
`github.pr_review` / `github.pr_merged` / `github.pr_closed` join the host
routes to your session (see the skill's "PR activity events"). Write ONE
`append_learning` file per learning (L1 atoms are immutable — always append,
never edit), titled with its category so the learnings-wiki sync groups them:

- `[approver/false-safe]` — WOULD_APPROVE where the human verdict (join or a
  later `github.pr_review`) was CHANGES_REQUESTED. Highest severity; include the
  missed evidence file:line.
- `[approver/human-disagreement]` — any other decision/human mismatch (e.g.
  BLOCK where the human approved), with both rationales.
- `[approver/clause-gap]` — a policy predicate proved wrong or imprecise.
- `[approver/challenger-miss]` — the human caught what the challenger cleared;
  quote what the challenger should have probed.
- `[approver/infra-abstain]` — every ABSTAIN_POLICY carrying an infra
  reason_code (NO_REVIEW_SIGNAL / HARNESS_FAIL / CLAUSE_UNEVALUABLE:<name> /
  CHALLENGER_INCOMPLETE / CRITIQUE_UNAVAILABLE / STALE_STAGE): the named
  artifact and root cause (these burn down the infra gate) — including a
  harvest that returned nothing AND a Devin run that failed. Keyed on the
  reason_code, not the decision string.
- `[approver/critique-mustfix]` — what the critique gate keeps correcting in the
  derivation; recurring ones are procedure bugs.

Structure each like the existing exemplars: Symptom / Root cause / How to catch
it / Fix. These compound through the wiki into Step 0's recall — the review
improves from human feedback.

## Invariants

- **This workflow stages, builds the review input, and hands off — nothing
  else.** It never decides/edits a decision and never writes to GitHub.
- **Reuse, don't re-derive.** The primary review is the one production CI already
  posted — harvest it, don't recompute it. Devin is the approver's own
  head-current signal and the sole signal when no bot review exists.
