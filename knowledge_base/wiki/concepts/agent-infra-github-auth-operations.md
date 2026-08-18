---
title: "GitHub Auth and Operations in Agent Containers"
type: concept
group: agent-infra
tags: [github, onecli, gh-cli, nv-slang-bot, workflows, pr-mapping, auth, proxy, credentials]
source_count: 27
---

# GitHub Auth and Operations in Agent Containers

> **Split 2026-08-17 at the 40 KB read cap.** The later incremental folds — the (resolved) 07-16/07-17 auth-outage diagnostics, the empty-list-looks-like-success trap, the Discussions write-block, PR-review-under-invalid-token, fork-PR takeover mechanics, and the third workflow-push boundary — moved to [part 2](agent-infra-github-auth-operations-2.md).

## TL;DR

- **`gh auth status` / `gh api user` / any identity probe is a FALSE-NEGATIVE.** They return 401 / "token invalid" / `app_not_connected` even when GitHub reads AND writes work. The `GH_TOKEN` is a GitHub App installation token with no `/user` identity. Never self-block on a probe.
- **Verify reads** with a real org-scoped call: `gh api repos/<o>/<r> --jq .full_name`. **Verify writes** by attempting the actual write and trusting its exit code / returned URL. Escalate "GitHub down" only on a real 4xx from the endpoint you need.
- **Works:** org-scoped REST `gh api repos/<o>/<r>/...` (GET + POST/PATCH comments, labels, bodies); `git push` of `fix/issue-*` branches; `gh pr create --draft`; raw-token `git push https://x-access-token:${GH_TOKEN}@github.com/...`.
- **Does NOT work:** GraphQL (`gh issue view`, `gh search`) → empty/`app_not_connected` (use REST); deep pagination (keep `--limit 100`, page 2 goes unauthenticated → 401).
- **nv-slang-bot perms:** `actions/contents/issues/pull_requests:write, metadata/org_projects:read`. NOT `workflows` — any push touching `.github/workflows/*` is rejected atomically (whole push fails). Route workflow patches to the orchestrator's PAT, or cross-fork via `slang-coworkers`.
- **Bot login is `nv-slang-bot`** (no `[bot]` suffix) — edit-in-place guards comparing to `"nv-slang-bot[bot]"` never match → duplicate POSTs. A session can only edit/delete comments IT created; cross-session comment edit 403s. Exactly one tier owns the issue-level 5-bullet.
- **Merge-queue enqueue is structurally blocked** for the bot — always escalate evictions for human requeue.
- **`report_pr_created({repo,pr_number})` binds the CALLING session.** Open the PR from the fix-chain session; never re-fire it from a non-owning session to "re-confirm" — that steals the PR's webhooks.
- **Fork-PR CI approval gate is keyed on origin-of-head (fork vs same-repo), not author** — the bot's same-repo `fix/issue-N` branches skip it.

This page covers everything about GitHub authentication, the OneCLI proxy, the `gh` CLI quirks, PR session mapping, workflow permission limits, and bot identity in NanoClaw agent containers.

## The Core Rule: `gh auth status` Is a False-Negative Probe

`gh auth status`, `gh api user`, and `gh api repos/szihs/*` return 401 / "token in GH_TOKEN is invalid" / "app_not_connected" **even when GitHub reads AND writes work**. Never treat them as proof that GitHub is unavailable, and never self-block based on them ([CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)](../learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md)).

GitHub traffic routes through a OneCLI HTTPS proxy that injects credentials by URL-path match. The git remote contains `x-access-token:placeholder@github.com`; the proxy swaps `placeholder` for the real path-matched secret. The `/user` endpoint the probe hits is a user-scoped endpoint the GitHub App installation token has no entitlement for — that says nothing about repo/org capability.

**Correct verification:** `gh api repos/shader-slang/slang --jq .full_name` → returns ⇒ token works. For writes, attempt the real operation and trust its exit code.

Concretely reconfirmed on the slang-reviewer container: `gh auth status` reports "The token in GH_TOKEN is invalid" and `slang-pr-review-runner`'s install.sh prints "gh auth not configured", yet `gh api repos/shader-slang/slang/pulls/<N>` and `gh pr diff <N> -R shader-slang/slang` BOTH succeed with that same token — GH_TOKEN is a GitHub App installation token that does not resolve to a user account (so the `auth status` user-lookup endpoint fails) but authorizes API calls fine. Unsetting GH_TOKEN to force a stored-cred fallback fails hard: there are no stored creds; the env token is the only auth. Before aborting a run over apparent auth failure, test the actual read you need ([gh auth status false-negative with App installation token (gh api still works)](../learnings/1782895550564-gh-auth-status-false-negative-with-app-installatio.md)).

The **write** side has the same trap and a costlier failure mode: the App token has no `/user` identity, so every identity/user probe returns 401 "token invalid" even while comment/reply/reaction/PR-comment writes succeed — an `app_not_connected` from a `gh` identity check is likewise not a verdict on the write path. To check whether writes work, **attempt the actual write** (e.g. `gh api --method POST repos/<o>/<r>/pulls/<PR>/comments/<CID>/replies -f body=... --jq '.html_url'` returns the posted URL on HTTP 201) and escalate "write path down" only on a real 4xx from *that* write endpoint. When authorized to post, post autonomously — routing a fully-drafted correct answer *up to parent* on a false auth-probe 401 wasted a round-trip and, worse, produced two byte-identical replies on a maintainer's thread when the parent both directed a retry and posted itself (the parallel-success race). Only merge-queue enqueue and `workflows`-scoped pushes are actually blocked for this identity; a repo-local PreToolUse hook (`gate-critique-on-deliver.sh`) can also false-positive on any `gh api .../pulls/...` command by substring-matching "pulls" as PR-creation — that's a gate misfire, not a GitHub failure ([gh auth status 401 is a FALSE NEGATIVE for nv-slang-bot App token — verify via a real write, never a probe](../learnings/1783388957871-gh-auth-status-401-is-a-false-negative-for-nv-slan.md)).

## What Works and What Does Not

**Works:** org-scoped REST via `gh api repos/<o>/<r>/...` (GET issues/PRs/comments; POST/PATCH comments, labels, PR/issue body); `git push` of `fix/issue-*` branches to origin; `gh pr create --draft`; raw-token fallback via `git push "https://x-access-token:${GH_TOKEN}@github.com/<o>/<r>.git" <branch>` and `curl -H "Authorization: Bearer ${GH_TOKEN}"`.

**Does not work:** GraphQL (`gh issue view`, `gh search issues`, `gh api search/issues`) → empty / `app_not_connected`. Use REST `gh api repos/<o>/<r>/issues/<n>` for reads; list recent issues and filter client-side for dup-search.

**Pagination 401:** keep `gh api` / `gh run list` / `gh pr list` to `--limit 100` (one page) — page-2 fetches go unauthenticated through the proxy and 401. Narrow by filter rather than deep-paging.

**Fork-PR CI approval gate does NOT apply to the bot fixer:** on a public repo GitHub gates Actions/CI on *fork-based* PRs from outside contributors behind a manual "Approve and run workflows" click, but that gate is keyed on **origin-of-head (fork vs. same-repo branch), not PR author** — the slang-fixer opens PRs from same-repo `fix/issue-N → master` branches, so its CI runs immediately and never hits fork-approval gating (corroborated on PR #12115). When reasoning about a PR-side triage flow, only the *community-contributor* lane (fork head) needs the extra maintainer-approve-workflow node; bot and team lanes (same-repo head) skip it — never claim the bot fixer "hit fork-PR workflow-approval gating" ([Fork-PR CI approval gate is keyed on origin-of-head, not PR author — and our bot fixer skips it](../learnings/1785530290363-fork-pr-ci-approval-gate-is-keyed-on-origin-of-hea.md)).

**Posting via `--field` with `@`-prefixed body:** `gh api --field body="@username..."` fails — gh interprets leading `@` as "read this from a file." Use `jq -Rs '{body: .}' < file.md | gh api ... --method POST --input -` or `--raw-field` / `-f` ([gh CLI --field expands @ as file path](../learnings/1778859843367-gh-cli-field-expands-as-file-path.md)).

## nv-slang-bot App Identity and Permission Catalog

`nv-slang-bot` carries: `actions:write, contents:write, issues:write, pull_requests:write, metadata:read, organization_projects:read`. It does NOT carry `workflows` — it can never push `.github/workflows/*` files. Comment `.user.login` is `nv-slang-bot` (no `[bot]` suffix) — edit-in-place guards comparing against `"nv-slang-bot[bot]"` never match, causing spurious duplicate POSTs instead of PATCHes ([CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)](../learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md)).

Two bot write operations that hit 403 despite having `issues:write`: (1) setting an issue assignee — create the issue then ask the human requester to self-assign; (2) editing (PATCH) a comment created by a different bot session — post a fresh delta comment instead ([nv-slang-bot 403 on issue-assign and cross-session comment-edit](../learnings/1782388835952-nv-slang-bot-403-on-issue-assign-and-cross-session.md)).

A session can edit/delete only the comments it itself created — editing another session's comment 403s even though both render as the same bot. Two tiers posting on one issue produce comments neither can later consolidate (needs a human). Exactly ONE tier owns the issue-level 5-bullet (edited in place) ([CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)](../learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md)).

## GitHub Workflow File Permissions (Structural Block)

The bot App lacks the `workflows` permission. Any commit that creates/edits a file under `.github/workflows/` is rejected on push — the rejection is atomic: the entire push fails including non-workflow files ([CONSOLIDATED: GitHub `.github/workflows/*` pushes & elevated permissions (bot can't; orchestrator's PAT pushes the patch on your behalf)](../learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md)).

Only the orchestrator holds a personal PAT with `workflow` scope. For a workflow change: (1) push the non-workflow part as the bot; (2) produce a git patch set of just the `.github/workflows/*` change; (3) send it up to the orchestrator via `send_file` with the target branch + base sha; (4) the orchestrator applies and pushes the workflow patch with its PAT.

`git push --dry-run` does NOT catch this rejection — it only happens at real push time. The stale-`origin/master` false rejection can trigger the same error text: fix by rebasing onto the real tip (`git ls-remote origin refs/heads/master` → `git fetch origin master` → `git rebase`).

**Cross-fork route (mechanics — but see the policy wall):** an alternative to routing the patch through the orchestrator's PAT is to push the branch to the `slang-coworkers/slang` fork (whose App install DOES grant `workflows`: `git push coworkers fix/issue-<n>`), then open a cross-fork PR into upstream `master` via the **REST API** — NOT `gh pr create`, whose GraphQL fails with "Fork collab can't be granted by someone without permission": `gh api -X POST repos/shader-slang/slang/pulls -f head="slang-coworkers:fix/issue-<n>" -f base=master -F draft=true -f body="$PR_BODY"`. `report_pr_created` still works for webhook routing. **CI caveat:** such a PR gets no `ci.yml` while it's a DRAFT — drafts skip the `pull_request` path, and `workflow_dispatch --ref` can't target a branch on the fork (upstream 422 "No ref found", fork 404) — so a green-less draft is expected; warn the maintainer or they'll think CI is broken ([Pushing workflow-file changes: App token lacks workflows perm → fork + REST cross-fork PR](../learnings/1783521395969-pushing-workflow-file-changes-app-token-lacks-work.md), [Bot App token lacks 'workflows' permission → workflow-file PRs must go cross-fork via slang-coworkers](../learnings/1783522205653-bot-app-token-lacks-workflows-permission-workflow-.md)). This route gets you a reviewable artifact, but a maintainer will still POLICY-CLOSE a coworker-bot workflow PR unmerged (see the ci-build-tooling page) — so flag workflow-scoped fixes as maintainer-only at triage rather than spending a fix cycle.

**Workflow DISPATCH vs PUSH are different surfaces:** dispatching/rerunning workflows via `gh workflow run` / `gh run rerun --failed` was transiently 403-blocked by an OneCLI gateway routing bug (now RESOLVED as of 2026-06-17). Merge-queue requeue (`enqueuePullRequest`) remains structurally blocked — the bot is not an authorized merger for protected `master`. Treat merge-queue evictions as always-escalate-for-human-requeue ([CONSOLIDATED: GitHub `.github/workflows/*` pushes & elevated permissions (bot can't; orchestrator's PAT pushes the patch on your behalf)](../learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md)).

## PR-Session Mapping and `report_pr_created`

`report_pr_created({repo, pr_number})` writes the `pr_session_mappings` row pointing at the **session that calls it**. Whichever session fires it last owns that PR's inbound webhook routing ([report_pr_created remaps the PR to the CALLING session](../learnings/1782606474451-report-pr-created-remaps-the-pr-to-the-calling-ses.md)).

When verifying that a PR's mapping exists, do NOT ask a non-owning session to "re-confirm" by re-firing `report_pr_created` — that silently remaps the PR to that session, stealing the PR's review/CI webhooks.

The PR must be opened from inside the fix chain's session (the one on `gh-issue-<owner>/<repo>-<n>`) ([report_pr_created binds the CALLING session — open the PR from the fix thread, not a chat](../learnings/1780723000000-report-pr-created-binds-the-calling-session-not-the-fix-thread.md)). If a PR is already mis-mapped: `UPDATE pr_session_mappings SET session_id=<fix-session>, thread_id='gh-issue-<owner>/<repo>-<n>' WHERE repo=? AND pr_number=?`. The webhook server reads the mapping live per-event, so no restart is needed.

## Degraded Session Behavior and Fallbacks

In a partially degraded gateway session, working REST/GraphQL paths may still succeed while `POST .../issues/<n>/labels` returns 403. Set Issue Type via GraphQL (works), then defer the label to a healthy session ([CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)](../learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md)).

When the token is invalid every `gh` call can silently return empty (not an error) — easy to mistake for "no result." For READ-ONLY needs on public repos, `WebFetch("https://github.com/<owner>/<repo>/issues/<N>")` retrieves title, body, author, state, labels with no token. WebFetch cannot post/label/set-type, and may miss long comment threads.

If a REST mutation 403s with an admin-rights message, try the GraphQL equivalent before concluding write is blocked. For editing bot's own comment: resolve node id then use GraphQL `updateIssueComment` mutation ([CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)](../learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md)).

## The /slang-pr-review Preflight Warning

Reviewer preflight "gh auth not configured" / `gh auth status` non-zero is NOT a reason to abort the `/slang-pr-review` pipeline. Reviewer A's `gh pr diff` / `gh api repos/.../pulls/N` work for public repos. Verify the real read endpoint before deciding gh is broken. Posting back is separately gated by the `<github-post-authorized />` marker ([CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)](../learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md)).

The mechanism behind the lie: `gh auth status` reports `GH_TOKEN` invalid because the local token is a placeholder, but outbound GitHub traffic routes through the onecli-gateway proxy (`HTTPS_PROXY`/`HTTP_PROXY` in the container env), which injects the real `nv-slang-bot[bot]` App installation token *on the wire* — so `gh api`/`gh pr view` succeed with full write access despite the invalid local token. This bites reviewers posting COMMENT-state reviews (`gh api .../pulls/N/reviews --method POST` via `post-review.sh`): a reviewer that runs `gh auth status` as a preflight and sees "invalid" may wrongly abort an authorized post and fall back to `send_file` only, when the POST would have succeeded. Don't gate posting on `gh auth status`. Preflight write access with an actual call (`gh pr view N -R owner/repo`), trust `post-review.sh`'s own 403→exit 3 handling as the authoritative write signal, and remember `shader-slang/*` repos are write-capable via the proxy-injected App token while `slang-coworkers/*` are read-only (App lacks write → 403/exit 3) ([gh auth status shows GH_TOKEN invalid but gh api succeeds via onecli-gateway proxy](../learnings/1783636613641-gh-auth-status-shows-gh-token-invalid-but-gh-api-s.md)).

Reviewer A can review the WRONG PR via stale `tmp/pr-diff.patch` from a prior run. Before any A run on a shared checkout: `rm -f /workspace/agent/slang/tmp/pr-diff.patch`. Independently verify the PR's real diff with `gh pr view <N> -R <repo> --json files,additions,deletions` + `gh pr diff <N> -R <repo> | head` ([slang-pr-review Reviewer A can review the WRONG PR via stale tmp/pr-diff.patch](../learnings/1780497941518-slang-pr-review-reviewer-a-can-review-the-wrong-pr.md)).

The same false-negative bites the reviewer's own preflight: a `gh api rate_limit` probe returning `401 app_not_connected` (alongside `gh auth status` "token invalid") is the App-installation-token quirk, NOT a write block — when posting was authorized on PR #12303, the real `post-review.sh` POST landed review id 4825141937 despite the alarmed preflight. Do not pre-declare a token block from a preflight 401; attempt the real op and treat only a failing *actual* write (401/403) as degradation (→ file-only + escalate for a GitHub-connection re-login, not a container restart). Two mechanical traps on the read-fallback path: a read-only local-git `gh` shim installed at `~/.local/bin/gh` (to resolve `gh pr diff`/`gh pr view` from `git fetch origin pull/<N>/head`) wins PATH and shadows `/usr/bin/gh`, so it must be REMOVED before the post step or it refuses the POST; and the runner's `post-back.sh`/`post-review.sh`/`cleanup.sh` are mode `-rw-r--r--` (not +x), so invoke via explicit `bash <script>` — an exit-126 "Permission denied" from post-back's internal `"$DIR/post-review.sh"` call is a chmod issue, not a token failure ([gh preflight 401 app_not_connected is an App-token quirk — real gh writes still work](../learnings/1785467915354-gh-preflight-401-app-not-connected-is-an-app-token.md)).

## Emsdk and CI Run Logs

Authenticated read of CI logs works even when `gh auth status` shows invalid: `gh run view <run-id> -R shader-slang/slang` and `gh run view --job <job-id> -R shader-slang/slang --log` both work via the read-only proxy path. Use this to find the last-good emsdk version: grep the last green run's wasm-job log for `Resolving SDK version 'X.Y.Z' to 'sdk-releases-<hash>-64bit'` ([Find last-good emsdk version for an emsdk-install-latest regression from the green run log](../learnings/1780624123110-find-last-good-emsdk-version-for-an-emsdk-install-.md)).

## nv-slang-bot login quirks: no [bot] suffix via gh; labels 403 fallback

Two GitHub-write quirks of the `nv-slang-bot` token. **Self-check:** the "edit-if-last-poster-is-self" snippet that tests `[ "$LOGIN" = "nv-slang-bot[bot]" ]` fails because `gh api .../comments --jq '.user.login'` returns the bot login **without** the `[bot]` suffix — match by substring instead ([edit-if-self check: nv-slang-bot login has NO [bot] suffix via gh — match by substring](../learnings/1782857315349-edit-if-self-check-nv-slang-bot-login-has-no-bot-s.md)). **Labels:** if `POST issues/:n/labels` returns 403, fall back to `gh issue edit --add-label`, which succeeds where the raw REST path is inconsistently denied ([GH labels: if POST issues/:n/labels 403s, fall back to gh issue edit --add-label](../learnings/1782866408005-gh-labels-if-post-issues-n-labels-403s-fall-back-t.md)).

## Re-pushing a fix branch: check the remote tip's AUTHOR first

Before force-pushing an amended commit to your `fix/issue-<n>` branch, always `git ls-remote origin <branch>` and inspect the remote tip's **author and parent** — a maintainer may have pushed merge commits or edits; never force over their work ([1783038459347-re-pushing-a-fix-branch-check-the-remo](../learnings/1783038459347-re-pushing-a-fix-branch-check-the-remote-tip-s-aut.md)).

## Merge hazard: two branches bumping a shared version counter collapse to one value

When two branches each bump the same version counter (e.g. `k_maxSupportedModuleVersion` 22→23), git **collapses both to a single 23** on merge with no conflict — it can't see that two independent increments were intended. Manually correct to the summed value (24). Surfaced resolving #11541 ([1783089145425-merge-hazard-two-branches-bumping-a-sh](../learnings/1783089145425-merge-hazard-two-branches-bumping-a-shared-version.md)).

## gh via OneCLI can be down while direct curl still works (2026-07-13 fold)

Extends the "gh auth status lies" finding above with a concrete bypass. When `gh` fails with `app_not_connected` / "GitHub is not connected in OneCLI" (HTTP 401) and `gh auth status` reports the GH_TOKEN "invalid", the token is often fine — the failure is the OneCLI proxy being disconnected, not the credential. **Workaround:** bypass OneCLI and hit `https://api.github.com` directly with `curl -H "Authorization: Bearer $GH_TOKEN"`; reads and writes (POST/PATCH comments) both succeed. `gh auth status` lies because the bot's GH_TOKEN is a GitHub *App installation* token — `GET /user` returns 403 for App tokens (no user identity), which is what `gh auth status` probes. Verify the token instead with `GET /repos/<owner>/<repo>` (returns 200); then post with `jq -Rsn --arg b "$BODY" '{body:$b}' | curl -s -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" -X POST ".../issues/N/comments" --data @-` (201 = posted). This saved a full triage from being blocked on GitHub observability ([gh via OneCLI can be down while direct curl to GitHub API still works](../learnings/1783873229538-gh-via-onecli-can-be-down-while-direct-curl-to-git.md)).

---

> **Later incremental folds moved to [part 2](agent-infra-github-auth-operations-2.md)** (2026-08-17): the resolved 07-16/07-17 auth-outage diagnostics, the empty-list-looks-like-success trap + unauth REST fallback, the Discussions write-block, reviewing/triaging under an invalid token, PR takeover from a contributor's personal fork, human-cred-merge ≠ bot-write-recovery, and the third `.github/workflows/*` push boundary.

**Source learnings (27):**
- [gh preflight 401 app_not_connected is an App-token quirk — real gh writes still work; remove the read-only local-git gh shim before posting](../learnings/1785467915354-gh-preflight-401-app-not-connected-is-an-app-token.md)
- [Fork-PR CI approval gate is keyed on origin-of-head (fork vs same-repo branch), not PR author — the bot fixer's same-repo-branch PRs skip it](../learnings/1785530290363-fork-pr-ci-approval-gate-is-keyed-on-origin-of-hea.md)
- [CONSOLIDATED: GitHub auth & ops in agent containers](../learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md)
- [gh CLI --field expands @ as file path](../learnings/1778859843367-gh-cli-field-expands-as-file-path.md)
- [nv-slang-bot 403 on issue-assign and cross-session comment-edit](../learnings/1782388835952-nv-slang-bot-403-on-issue-assign-and-cross-session.md)
- [CONSOLIDATED: GitHub .github/workflows/* pushes and elevated permissions](../learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md)
- [report_pr_created remaps the PR to the CALLING session](../learnings/1782606474451-report-pr-created-remaps-the-pr-to-the-calling-ses.md)
- [report_pr_created binds the CALLING session — open the PR from the fix thread, not a chat](../learnings/1780723000000-report-pr-created-binds-the-calling-session-not-the-fix-thread.md)
- [slang-pr-review Reviewer A can review the WRONG PR via stale tmp/pr-diff.patch](../learnings/1780497941518-slang-pr-review-reviewer-a-can-review-the-wrong-pr.md)
- [Find last-good emsdk version for an emsdk-install-latest regression from the green run log](../learnings/1780624123110-find-last-good-emsdk-version-for-an-emsdk-install-.md)
- [slang-maintainer container cannot post to GitHub](../learnings/1780356530581-slang-maintainer-container-cannot-post-to-github.md)
- [Slang CI: splitting a build/test job — Git-Bash-PATH gotcha + bot cannot push workflow files](../learnings/1780769325863-slang-ci-splitting-a-build-test-job-git-bash-path-.md)
- [Marked-block sha256 pattern for cross-file drift detection](../learnings/1779985772055-marked-block-sha256-pattern-for-cross-file-drift-d.md)
- [Holding a fixer PR as draft enables clean maintainer supersession](../learnings/1781245034372-holding-a-fixer-pr-as-draft-enables-clean-maintain.md)
- [Broad-blast-radius lowering changes need a FULL local slang-test sweep](../learnings/1782162119070-broad-blast-radius-lowering-changes-need-a-full-lo.md)
- [NVAPI render-tests silently ignored — submodule→FetchContent migration left render-test path stale](../learnings/1782215118821-nvapi-render-tests-silently-ignored-submodule-fetc.md)
- [slang #11568: maintainer "base PR on #11723" is a layer-mismatch](../learnings/1782579642375-slang-11568-maintainer-base-pr-on-11723-is-a-layer.md)
- [edit-if-self check: nv-slang-bot login has NO [bot] suffix via gh — match by substring](../learnings/1782857315349-edit-if-self-check-nv-slang-bot-login-has-no-bot-s.md)
- [GH labels: if POST issues/:n/labels 403s, fall back to gh issue edit --add-label](../learnings/1782866408005-gh-labels-if-post-issues-n-labels-403s-fall-back-t.md)
- [gh auth status false-negative with App installation token (gh api still works)](../learnings/1782895550564-gh-auth-status-false-negative-with-app-installatio.md)
- [Re-pushing a fix branch: check the remote tip's AUTHOR first — never force over a maintainer push](../learnings/1783038459347-re-pushing-a-fix-branch-check-the-remote-tip-s-aut.md)
- [Merge hazard: two branches bumping a shared version counter collapse to one value (git can't see it)](../learnings/1783089145425-merge-hazard-two-branches-bumping-a-shared-version.md)
- [gh auth status 401 is a FALSE NEGATIVE for nv-slang-bot App token — verify via a real write, never a probe](../learnings/1783388957871-gh-auth-status-401-is-a-false-negative-for-nv-slan.md)
- [Pushing workflow-file changes: App token lacks workflows perm → fork + REST cross-fork PR](../learnings/1783521395969-pushing-workflow-file-changes-app-token-lacks-work.md)
- [Bot App token lacks 'workflows' permission → workflow-file PRs must go cross-fork via slang-coworkers](../learnings/1783522205653-bot-app-token-lacks-workflows-permission-workflow-.md)
- [gh auth status shows GH_TOKEN invalid but gh api succeeds via onecli-gateway proxy](../learnings/1783636613641-gh-auth-status-shows-gh-token-invalid-but-gh-api-s.md)
- [gh via OneCLI can be down while direct curl to GitHub API still works](../learnings/1783873229538-gh-via-onecli-can-be-down-while-direct-curl-to-git.md)
_Catalog: [[wiki/index.md]]_
