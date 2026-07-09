---
name: slang-pr-approve
license: MIT
type: workflow
description: 'Stage a PR at a pinned commit, delegate the review to {{vars.reviewer}} (the reviewer coworker — the approver never reviews code itself), then hand the returned review doc to the slang-pr-approver skill for one auditable decision. One uniform model for both modes: LIVE (ready_for_review trigger — the PR head) and OFFLINE/HISTORICAL (a round manifest of (pr, commit) targets — the R0-pinned commit). In both, the reviewer is dispatched over the PR at that commit and returns a review doc (markdown + embedded JSON result); the decision procedure is identical and always critique-gated. This workflow never makes, edits, or posts a decision, and never runs the review itself.'
requires: [code.read]
uses:
  skills: [slang-pr-approver]
---

# /slang-pr-approve — stage the PR, delegate the review, then decide

You run inside the lab container with read-only `gh` and a mounted `policy/`
(APPROVAL_POLICY.json). You have two things bound: the `slang-pr-approver`
skill (the decision procedure of record) and a **`{{vars.reviewer}}`** destination
(the reviewer coworker that actually reviews the code).

**You never review code.** This workflow stages a PR at one pinned commit,
**delegates the review to `{{vars.reviewer}}`**, waits for the review doc it sends
back, then hands that doc to `/slang-pr-approver`. There is one uniform model:
a real PR at a specific commit, reviewed through the same reviewer path, in
both modes. Only *which* commit and *where the PR list comes from* differ.

## The uniform contract (both modes)

For each PR to decide, you build a per-PR session workspace `work/<pr>-<sha12>/`
that satisfies the `slang-pr-approver` skill's **Input contract** (see the
skill — it owns the field definitions): `tmp/context.json` (repo, pr, the one
pinned `commit_sha`, `mode`, and the historical-only `human_verdict`) plus
`review/review-doc.md` (the review doc `{{vars.reviewer}}` returns — the only source
of the verdict; there is no local `final-review.md` and no bundled runner).
The two modes differ only in *which* commit gets pinned and *where the PR list
comes from* — the staging below fills that same contract either way.

## Steps

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

### Step 1: determine the mode and the PR list from the tasking message

- Message carries a **manifest path** (e.g.
  `pr-snapshots/task-manifest-round-001.json`) → **OFFLINE/HISTORICAL batch**.
  The manifest lists entries: `{pr, mode: historical, revisions: [{index,
  head_sha, human_verdict, reviewed_at}, …]}`. Each `head_sha` is the commit a
  human actually reviewed (R0 = the first). The manifest carries **no diffs and
  no snapshots** — just the (pr, commit, human_verdict) triples. Process
  round by round.
- Message carries a **PR list but no manifest** → generate the manifest first:
  `scripts/prepare-offline-rounds.py --prs <list> --out pr-snapshots` (in the
  slang-pr-approver skill). It resolves each PR's reviewed commits with
  read-only gh and emits round manifests of (pr, commit, human_verdict)
  triples — nothing else is downloaded. Then proceed as a normal offline batch.
- Message carries the **webhook dispatch wire format** (from the
  orchestrator's slang-github-webhook routing of `github.pr_ready_for_review`)
  → **LIVE — approver-dispatched (Case 2)**. Parse the byte-exact trailer lines
  with `grep -oE`: `REPO={repo}`, `PR={pr_number}`, `MODE=pr-approve` (tolerate
  other MODE values — the trailer's REPO/PR are authoritative); the body also
  carries the reason (`ready_for_review` | `opened` | `synchronize`) and may
  carry `<github-post-authorized />`. **You dispatch the review** (Step 1b) —
  the reviewer is downstream of you here, exactly like the offline path.
  - reason `opened` / `ready_for_review` → the PR's current head is the commit.
  - reason `synchronize` → the host lands this in the SAME PR session
    (pr_session_mappings): continue the existing thread as a new revision turn
    — the new head is the commit, note the delta from the previous head, run a
    fresh review + decision (it supersedes the earlier row for this PR).
- Message is a **`[Review Verdict]` from `{{vars.reviewer}}` with a
  `combined-review.md` attached** (arrived on thread `gh-pr-<repo>-<num>`) →
  **LIVE — reviewer-forwarded (Case 1)**. The review already happened: a bot PR
  went `orch→triager→fixer⇄reviewer` (or an `@nv-slang-bot` mention) and the
  reviewer forwarded its doc to you downstream. **Do NOT dispatch a reviewer**
  — you'd be commissioning a redundant second review. Save the attached
  `combined-review.md` as `work/<pr>-<sha12>/review/review-doc.md`, stage the PR
  context (Step 1a, `mode=live`/`live_late`), then **skip Step 1b** and go
  straight to Step 2. Because it arrived on `gh-pr-<repo>-<num>`, a later Case-2
  `synchronize` on the same PR continues THIS session — one decision thread per
  PR regardless of which case opened it.

### Step 1a: stage the PR at its commit (both modes)

Build `work/<pr>-<sha12>/` and write `tmp/context.json` with the commit for
this mode:

- **LIVE**: `commit_sha` = the PR's current head (`gh pr view <pr> --repo
  <repo> --json headRefOid`). `mode` = `live_late` if any human review already
  exists on the PR, else `live`. `human_verdict` = null.
- **HISTORICAL**: `commit_sha` = the manifest revision's `head_sha` (R0 for the
  headline metric; each Rn in a `--per-revision` chain in turn). `mode` =
  `historical`. `human_verdict` = the manifest's `human_verdict` for that
  revision — recorded for the scorer, NEVER shown to the skill or the reviewer
  before the decision (it leaks the answer).

You do NOT download the diff here — `{{vars.reviewer}}` fetches the PR itself. You
only pin the commit and hand it over.

### Step 1b: delegate the review to `{{vars.reviewer}}` (Case 2 + offline only — SKIP in Case 1)

**Skip this whole step when the review was reviewer-forwarded (Case 1)** — you
already have `review/review-doc.md`; dispatching now would commission a
redundant second review. This step runs only when YOU are the one commissioning
the review: the webhook dispatch (Case 2) and every offline/historical entry.

Dispatch the review with `send_message` (the fix-issue step-8 pattern), then
**end your turn** and wait for the reply — Reviewer A's pipeline runs
~20–30 min; do not poll, and do not reply to status echoes (spine's
"don't reply to status echoes" rule).

```
send_message(
  to: "{{vars.reviewer}}",
  text: "[Approval Review Request] {repo}#{pr} @ {commit_sha}\n\nMode: pr\nPR: {pr_url}\nCommit: {commit_sha}\nReview this PR at the commit above and send the combined review doc back to me.\n\nMODE=pr-approve\nREPO={repo}\nPR={pr}\nCOMMIT={commit_sha}{maybe_post_marker}"
)
```

- `{maybe_post_marker}` = a trailing `\n<github-post-authorized />` **only** in
  LIVE mode when the webhook dispatch carried that marker — it authorizes the
  reviewer to also post its COMMENT-state review to the live PR. In HISTORICAL
  mode NEVER include it: the reviewer must not post bot comments onto old /
  merged PRs; it returns the review doc by reply only.
- The `MODE=pr-approve` line tells `{{vars.reviewer}}`'s workflow this is an
  approval-review dispatch, so it returns the review doc to you (its requester)
  and **skips the fixer forward** (see the reviewer workflow's conditional in
  `/slang-pr-review` step 5). Keep the `MODE=`/`REPO=`/`PR=`/`COMMIT=` lines
  byte-exact (`grep -oE`).

On the reviewer's substantive reply (the `[Review Verdict]` message + the
combined review doc, delivered via `send_file`): save the doc to
`work/<pr>-<sha12>/review/review-doc.md`. If the doc is absent, empty, or has
no parseable embedded result after the reviewer signals completion → the skill
records ABSTAIN_INFRA (`REVIEW_DOC_MISSING`); do not re-request more than once.

**Revision chains** (historical `--per-revision`, or live `synchronize`
follow-ups) run in ONE session, replaying the PR's history: for each later
revision Rn, IN THE SAME SESSION, stage Rn's commit, note the delta from Rn-1,
dispatch a FRESH review of Rn's commit, and decide again. Earlier turns are
context — the discussion a real reviewer would remember — never evidence: each
decision cites only its own revision's review doc. One ledger row per (pr,
revision head).

### Step 2: decide (both modes converge here)

The PR workspace now satisfies the `slang-pr-approver` skill's input contract
(`tmp/context.json` + `review/review-doc.md`). Invoke the skill for each PR
workspace. It performs the deterministic clauses, verdict parse (from the
review doc), challenger, critique-gated record — identically for historical and
live. This workflow never makes or edits a decision itself.

### Step 3: report

After all entries: post one summary line per decision to
`dashboard:slang-pr-approver` (the per-decision `[Approval Decision]`
messages are emitted by the skill, not the workflow) and return counts per
state: would_approve / abstain_policy / abstain_infra / block.

### Step 4: capture learnings (after EVERY revision decision, and last)

Failure is training data, and it arrives per revision: run this after
each Rn's decision (the human review of Rn-1 you just replayed or
received IS the feedback for Rn-1's decision), on every live
`github.pr_review` join, and once more at session end as a sweep for
anything missed. Write ONE `append_learning` file per learning (L1 atoms
are immutable — always append, never edit), titled with its category so
the learnings-wiki sync groups them:

- `[approver/false-safe]` — WOULD_APPROVE where the human verdict (join or
  a later `github.pr_review`) was CHANGES_REQUESTED. Highest severity;
  include the missed evidence file:line.
- `[approver/human-disagreement]` — any other decision/human mismatch
  (e.g. BLOCK where the human approved), with both rationales.
- `[approver/clause-gap]` — a policy predicate proved wrong or imprecise
  (e.g. executable under docs/ slipped a class boundary).
- `[approver/challenger-miss]` — the human caught what the challenger
  cleared; quote what the challenger should have probed.
- `[approver/infra-abstain]` — every ABSTAIN_INFRA: the named artifact and
  root cause (these burn down the infra gate) — including a review doc the
  reviewer never returned or one that wouldn't parse.
- `[approver/critique-mustfix]` — what the critique gate keeps correcting
  in the derivation; recurring ones are procedure bugs.

Structure each like the existing exemplars: Symptom / Root cause /
How to catch it / Fix. These compound through the wiki into Step 0's
recall — the review improves from live human feedback at zero replay
cost. (Formal-evidence runs still key on the review doc's result hash;
recalled learnings are challenger context, not silent protocol changes.)

## Mode invariants

- **Historical mode is R0-pinned and comment-free.** The reviewer gets the R0
  commit, never the merged head, and never the `<github-post-authorized />`
  marker — no bot comments land on old PRs. `human_verdict` from the manifest
  is scoring ground truth only, withheld from the reviewer and the skill.
- **This workflow stages, delegates, and hands off — nothing else.** It never
  reviews, decides, edits a decision, or writes to GitHub. (The reviewer's
  invariants and the approver's are stated once each in their own files.)
