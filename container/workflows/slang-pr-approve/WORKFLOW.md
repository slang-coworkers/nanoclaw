---
name: slang-pr-approve
license: MIT
type: workflow
description: 'Stage inputs for the approval-decision pipeline, then hand each PR to the slang-pr-approver skill. Two entry modes converge on one workspace contract: OFFLINE/HISTORICAL batches from a round manifest of R0-pinned snapshots (reviewer runs in patch mode), or a LIVE PR number from the ready_for_review trigger (current head staged via read-only gh; reviewer runs in pr mode). The decision procedure itself is identical in both modes and always critique-gated; this workflow never makes or edits a decision.'
requires: [code.read]
uses:
  skills: [slang-pr-approver, slang-pr-review-runner]
---

# /slang-pr-approve — stage inputs, then decide

You run inside the lab container. The mounted workspace always provides:
`pr-snapshots/` (host-downloaded PR folders), `policy/` (APPROVAL_POLICY.yaml),
the `slang-pr-review-runner` skill (six-agent reviewer), the
`slang-pr-approver` skill (decision procedure), and read-only `gh`.

This workflow does ONE thing: normalize the inputs for the requested PR(s)
into a per-PR session workspace, then hand each to `/slang-pr-approver`.
The decision procedure is identical in both modes — only staging differs.

## Steps

### Step 0: determine the mode from the tasking message

- Message carries a **manifest path** (e.g.
  `pr-snapshots/task-manifest-round-001.json`) → **OFFLINE/HISTORICAL batch**.
  The manifest lists entries: `{pr, slug, mode: historical, r0_head_sha}`.
- Message carries a **PR list but no manifest** → generate the rounds first:
  `scripts/prepare-offline-rounds.py --prs <list> --out pr-snapshots` (in the
  slang-pr-approver skill). It downloads R0-pinned snapshots with read-only
  gh — pr.json (author_association), fully-paginated reviews, files, r0.json,
  and the merge-base three-dot `diff.patch` at R0 — then emits round
  manifests. Then proceed as a normal offline batch, round by round.
- Message carries a **repo + PR number** (the ready_for_review trigger)
  → **LIVE single PR**.

### Step 1a: OFFLINE/HISTORICAL staging (per manifest entry)

1. Create `work/<pr>-<r0sha12>/` in the session.
2. Copy `pr-snapshots/<slug>/` contents in: `pr.json`, `diff.patch`,
   `files.txt`, `body.md`, `commits.json`.
3. Verify the snapshot is R0-pinned: `r0_head_sha` from the manifest must
   match the snapshot's recorded head. Mismatch or missing R0 artifacts →
   record ABSTAIN (`r0_artifacts_missing`) via the skill's Step 4 and move
   to the next entry. Never substitute the final head for R0.
4. Produce the review if absent: run `slang-pr-review-runner`
   `compose-and-run.sh --mode patch --patch work/<pr>-<r0sha12>/diff.patch`.
   Patch mode derives the integrity marker from the patch hash — no network.
5. The runner leaves `final-review.md`, per-agent findings, and
   `tmp/context.json` in the run dir; link/copy them into the PR workspace.

### Step 1b: LIVE staging (single PR)

1. Create `work/<pr>-<headsha12>/`.
2. Stage the CURRENT head with read-only gh: `gh pr view` (metadata →
   `pr.json`), `gh pr diff` (→ `tmp/pr-diff.patch`), changed paths
   (→ `tmp/pr-files.txt`), and write `tmp/context.json`
   `{repo, pr, base_sha, head_sha, diff_sha256}`.
3. If any human review already exists on the PR, note `mode=live_late` in
   the workspace marker; else `mode=live`.
4. Run the reviewer: `compose-and-run.sh --mode pr --pr <n>` (its
   diff-integrity guard re-verifies the head; a mismatch aborts the run —
   restage and retry once, then ABSTAIN `stale_stage`).

### Step 2: decide (both modes converge here)

The PR workspace now satisfies the `slang-pr-approver` skill's input
contract. Invoke the skill for each PR workspace. It performs the
deterministic clauses, verdict parse, challenger, critique-gated record —
identically for historical and live. This workflow never makes or edits a
decision itself.

### Step 3: report

After all entries: post one summary line per decision to
`dashboard:slang-pr-approver` (the per-decision `[Approval Decision]`
messages are emitted by the skill, not the workflow) and return counts per
state: would_approve / abstain_policy / abstain_infra / block.
