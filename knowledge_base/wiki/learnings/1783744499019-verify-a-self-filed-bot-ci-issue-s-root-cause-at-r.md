---
title: "Verify a self-filed bot CI issue's root cause at receipts level — it can be wrong"
type: learning
topic: ci-tooling
source: learnings/1783744499019-verify-a-self-filed-bot-ci-issue-s-root-cause-at-r.md
---

# Verify a self-filed bot CI issue's root cause at receipts level — it can be wrong

**Context:** slang#12062, a `nv-slang-bot` self-filed CI-health tracking issue, claimed the `board-sync` HTTP 422 was caused by a "hard-coded/stale bot global node id `BOT_kgDOCnlnWA` baked into the assignment logic" of `.github/workflows/pr-board-sync.yml`, with a suggested fix of "re-resolve the node id at runtime."

**The claim was false, and only receipts caught it:**
- `grep BOT_kgDOCnlnWA .github/` → empty; `git log -S BOT_kgDOCnlnWA --all` → empty. The id was NEVER in the repo. There was nothing to "re-resolve."
- The workflow's assignment/reviewer code uses REST calls (`addAssignees`, `requestReviewers`, `removeRequestedReviewers`) that pass **login strings**, not GraphQL node ids — so a "global node id" error can't originate from our own arguments.
- The real cause was **server-side**: the id belonged to a phantom *requested reviewer* already sitting on PR #11964 (a removed/renamed bot App). GitHub 422s while re-validating a PR's existing reviewer set on ANY reviewer-mutation REST call to it, even when our call names a different login.
- The failing step was `Unrequest ignored reviewers` (`removeRequestedReviewers` @ yml:1290) — the ONLY reviewer/assignee mutation not wrapped in the fail-safe try/catch its two siblings had. The `assignment failed for #11964 ... BOT_kg...` line in the same log was a *caught warning*, a red herring that made the id look like it came from the assignment path.

**Reusable method for CI-failure triage:**
1. Read the actual failing-job step API (`gh api .../actions/jobs/<id> --jq '.steps[]'`) to find which step conclusion=failure — don't trust the issue's attribution.
2. Read the job log window and note the **response URL** on the HttpError — it names the exact REST endpoint (here `.../pulls/11964/requested_reviewers`), which pinned it to reviewers, not assignment.
3. `grep`/`git log -S` the cited magic constant across `.github/` before believing "hard-coded in the workflow."
4. A "global node id" 422 on a call where YOU only pass logins ⇒ the stale node is a pre-existing server-side entity on the target PR, not something in your code.

**Fix that followed:** wrap the one unguarded mutation in the same try/catch the two siblings already use (fail-safe best-effort). Principled because the malformed shape is a server-side reviewer entry we don't own — fail-safe, not a producer fix. Bot can't PR `.github/workflows/**` (no `workflows` write) → delivered as an advisory git-apply diff comment for a maintainer.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1783744499019-verify-a-self-filed-bot-ci-issue-s-root-cause-at-r.md`_
