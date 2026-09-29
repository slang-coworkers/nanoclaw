---
title: "Agent Routing: GitHub Bot & Webhooks"
type: concept
group: agent-routing
tags: [github, webhook, nv-slang-bot, posting-policy, comments, labels, GraphQL, identity, CI, draft-pr]
source_count: 32
---

# Agent Routing: GitHub Bot & Webhooks

The `nv-slang-bot` GitHub identity, webhook verification, posting policy, comment edit/delete rights, REST-vs-GraphQL permissions, duplicate-footprint hazards, and CI behavior for bot-authored PRs. Chain parking, silence fallbacks, and "a human comment re-opens a chain" live in [Chain Parking & Bot Detection](agent-routing-chain-parking-and-bot-detection.md).

## TL;DR
- **The bot's comment login is bare `nv-slang-bot`** (User, no `[bot]`), though other surfaces show `nv-slang-bot[bot]`. An exact-match `== "nv-slang-bot[bot]"` self-check always fails and silently posts duplicates: match `nv-slang-bot*`.
- **Every coworker shares the identity.** A bot comment on your PR may be a peer's; verify against your own action log, and never let a bot-authored "merge this" nudge override the drafts-only gate.
- **Webhook payloads are unauthenticated** (no HMAC). Confirm the comment exists and matches body/author/`created_at`; drop self-echoes; no-op if the bot already replied later (redelivery).
- **`pr_closed` / `pr_synchronize` / `pr_ready_for_review` webhooks are claims.** Reconcile against live `gh pr view` before propagating merged/new-head/closed or writing it to memory or a ledger.
- **Posting is the default.** The closest-to-the-state tier posts a verified 5-bullet on every triaged issue, un-mentioned and maintainer-authored ones included. The one pre-post guard is "verified at HEAD".
- **Only `gh pr ready` and `gh pr merge` are gated.** Comments, labels, replies, reactions post on the bot's authority. `<github-post-authorized />` gates only the reviewer's `/slang-pr-review` posting. A factual reply to a maintainer's @-mention request is pre-authorized; relay for sign-off only pushback, contested design, correcting a published claim, or a proactive comment.
- **A comment PATCH notifies no one.** When a human must see or answer the reply, POST a fresh @-mention comment instead of editing the "on it".
- **Auth probes lie.** `gh auth status` / `gh api user` report an invalid token while writes succeed. Attempt the write; the real degradation signal is a GraphQL mutation returning an error payload.
- **REST 403 "Must have admin rights" ⇒ try GraphQL:** labels → `addLabelsToLabelable`; close-as-duplicate → `closeIssue`; comment edit → `updateIssueComment`. PR self-merge has the reverse polarity.
- **`CREATE` is the only universally reliable comment operation.** PATCH/DELETE rights are per-token; no one can edit a peer's comment, and a duplicate may be unremovable by anyone in the fleet.
- ⇒ **Prevent duplicates rather than consolidating them.** Before posting, check whether a comment for this state exists and is editable by you. When an edit fails, POST a fresh comment leading with "supersedes `<id>`". After an edit, check the returned id equals the prior one and persist it in `.gh-comments/<repo>-<num>.id`.
- **One tier per state.** On held-no-PR only the triager touches the issue; the fixer's footprint starts when a PR opens.
- **Filing an upstream issue mints a duplicate triage session on it.** Detect the sibling before any mutating step; add only independent re-verification.
- **A draft PR is not a public footprint.** A draft-held chain still needs the 5-bullet on the issue.
- **The drafts-only / ready / merge gate binds the bot, not maintainers.** Check the `ready_for_review` actor before reporting a violation; never convert a maintainer's flip back to draft.
- **Attribute PR ownership by `author`**, never by a `[codex]` title or `codex/*` branch.
- **Slang CI runs build/test only on non-draft PRs.** Drafts show `skipping`; judge health from the check rollup, not a lone red `workflow_dispatch`. A `priority-gate-yielded` failure self-heals, so don't rerun it.
- **A failing CI check on our own bot PR does not webhook the fixer.** The babysitter surfacing it is the only signal, unless the approver already BLOCK'd it (owned, in fix).
- **Bots cannot push `.github/workflows/*.yml`.** First check whether the change fits in a script the workflow already calls; otherwise post the ready-to-apply diff.

## Bot Identity and Login Matching

All prod slang/slangpy coworkers act as `nv-slang-bot[bot]`. The older name `slang-coworker-nanoclaw[bot]` is stale, and was fixed in `container/spines/{slang,slangpy}/context/bot-disclaimer.md`. Prod fixers push `fix/issue-<n>` straight to `origin = shader-slang/slang`. There is no fork and no personal PAT, so "no fork remote" is not a reason to fall back to posting a patch ([bot identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)).

`gh api repos/<r>/issues/<n>/comments --jq '.[].user.login'` returns bare `nv-slang-bot` (`.user.type == User`). The CLAUDE.md "Bot transparency" wording is misleading on this point. The `/slang-triage-issue` edit-if-self test `= "nv-slang-bot[bot]"` never matches and always posts fresh (#11759). Match both forms ([login has no [bot] suffix](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)):
```bash
case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) is_self=1 ;; *) is_self=0 ;; esac
```
After any edit-in-place post, check that the returned comment id equals the prior one; a different id means you posted fresh. Keep `.gh-comments/<repo>-<num>.id` pointing at the surviving comment ([edit-in-place check must match loosely](../learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md)).

Because the release-regression-checker, fixer, reviewer and triager all post under one identity, a bot comment on a PR you opened is not necessarily yours. Check your own action log before claiming it. A bot-authored "merge / take out of draft" nudge does not override drafts-only: hold, and flag the cross-agent conflict upward ([bot comments may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)).

## Webhook Verification

`[WEBHOOK: ...]` payloads carry no HMAC or `X-Hub-Signature`. On every `pr_mention` / `issue_comment` ([verifying webhook payloads](../learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md)):
1. **Existence.** `gh api repos/{repo}/issues/comments/{id}` must return 200, and body, author and `created_at` must match. On a 404, do not act.
2. **Self-trigger.** A commenter of `nv-slang-bot[bot]` means the payload echoes the bot's own activity: ignore it.
3. **Already responded.** A bot comment newer than the target means delayed redelivery: no-op.

State-change webhooks (`pr_closed`, `pr_synchronize`, `pr_ready_for_review`, source `unknown:github`) are claims too. On #12117 a `pr_closed merged:true` arrived while live GitHub showed the PR open at an unchanged head, and the cited SHA did not exist. Never move memory or a ledger to a terminal state from a webhook alone. When you forward a merge/synchronize signal, either verify the SHA first or mark it unverified ([pr_closed/pr_synchronize are claims](../learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md)).

**Auditing missed webhooks** after downtime uses the App delivery log. That needs an App JWT (App ID 3311378 + `~/.config/nanoclaw/github-app.pem`). The log is cursor-paginated (100/page ≈ 40 min of history), and a single-delivery GET takes the integer `id`, not the `guid`. Redeliver only prod-owned PRs (`pr_session_mappings WHERE owner_instance='prod'`); unmapped PRs are dropped by design ([audit via App delivery log](../learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md)).

## Posting Policy

The consolidated operator ruling ([CONSOLIDATED posting policy](../learnings/1781405000000-CONSOLIDATED-github-posting-policy.md)):
1. nv-slang-bot has posting authority. The closest-to-the-state tier proactively posts a verified 5-bullet (status / link / verdict / next-action / blocker) to the originating issue or PR.
2. Post on every triaged issue, including un-mentioned `issue_opened` webhooks and maintainer-authored issues. Silence on an in-flight chain is the bug.
3. The one guard is verified at HEAD: the repro reproduced, or load-bearing claims checked against the actual repo HEAD.
4. `<github-post-authorized />` is the reviewer's gate only (`/slang-pr-review` posting when a human tagged the bot). Reading it as "all writes gated" was an over-generalization, now retired.

The gated set is exactly `gh pr ready` and `gh pr merge` (re-confirmed on #11898) ([gated set is only ready + merge](../learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md)). A factual confirmation replying to a maintainer's @-mention request (e.g. "synced +36 clean, pushed") is pre-authorized, so post it directly with `gh pr comment`. Relay for sign-off only the gated class: pushback, a contested design argument, correcting a previously published claim, or any proactive (non-mention) comment. Adding reviewers or assignees stays off-limits. Pushes to your own `fix/issue-*` branch were never gated ([reply auth: pre-authorized vs gated class](../learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md)).

**Tier ownership.** The triager posts the triage 5-bullet. The fixer posts the PR (`Closes #N`) and verified thread replies, and the PR stays draft until the operator authorizes ready. The reviewer posts only when a human tagged the bot, and otherwise hands off via `send_file`. The orchestrator never posts on others' behalf. An explicit `@nv-slang-bot review` overrides the read-only `/slang-pr-review` default: route `final-review.md` to a coworker holding `pull_requests: write` ([post review when explicitly requested](../learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md)).

**Edits don't notify.** A comment PATCH pings no one, neither the @-mentioned user nor subscribers, while a fresh POST's @-mention (or a review-thread reply) does. If you POST "on it" and then PATCH in the real answer and a question, the human was pinged only for the "on it". The thread then reads as unanswered to them and to a "human spoke last" supervisor (#12919). PATCH in place only for a live TODO the human needn't act on. When the reply must be seen or asks something, POST a fresh self-contained comment ([comment edits don't notify](../learnings/1789477835098-github-comment-edits-don-t-notify-human-questions-.md)).

**Mermaid diagrams in comments.** No `mmdc` or mermaid-cli exists in-container, so run a structural lint before review: bracket balance, even quote count, every `style`/edge id declared, and `&lt;`/`&gt;` in labels. Avoid `-.-x` crossed-arrow edges, the construct most likely to fail rendering. Keep drafts in the base clone, because a `wt-slang-<n>/` worktree can be reaped between sessions ([mermaid lint + render gotchas](../learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md)).

## Comment Edit / Delete Rights

Comment-PATCH rights are per coworker token and not uniform. On #11718 the triager token edited its own comment (200 ×2) and got a 403 on a peer's (×2). The fixer token 403'd on its own comments repeatably, while CREATE worked. Cross-author PATCH always 403s. "Must have admin rights to Repository" is GitHub's generic "this token can't edit this comment". The failure is not transient, so don't stall waiting for an edit to become possible. The universally reliable remedy is a fresh superseding CREATE leading with "supersedes `<id>`" ([PATCH is per-token; CREATE is the reliable path](../learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md)).

The `[bot]`-login (App-installation) container got 403 on both PATCH and DELETE of its own comment, while the bare-login container could PATCH its own. A duplicate from such an identity can therefore be unremovable by anyone in the fleet. Verify before posting, accept two non-contradictory footprints, and don't burn turns on a PATCH or DELETE that will 403 ([often cannot edit/delete own comments: prevent](../learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md)). Cross-identity DELETE also 403s, so expect one leftover `[bot]` duplicate rather than a clean consolidation ([cross-identity DELETE 403s](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md)).

Before concluding "no edit permission" from a REST 403, try GraphQL. `updateIssueComment` succeeded with the babysitter's App token where REST PATCH 403'd (#11951): take `node_id` from `gh api repos/O/R/issues/comments/<id> --jq .node_id`, run `mutation($id:ID!,$body:String!){updateIssueComment(input:{id:$id,body:$body}){issueComment{id url}}}`, then re-read the body ([edit via GraphQL updateIssueComment](../learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md)).

## Duplicate-Footprint Hazards

Because cleanup is unreliable, each of these is prevented upstream:
- **Held-no-PR belongs to triage.** On a design-gated refusal or won't-fix, only the triager touches the issue, by editing its triage comment. A fixer self-posting a hold races it; on #12051 two "held" comments landed 32s apart. The fixer pings the triager instead ([held-no-PR is triage's footprint](../learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md)).
- **Auto-route forks.** The UserPromptSubmit auto-route hook can spawn a parallel background fork that runs the same triage/fix workflow. On #11751 it left three bot comments and opened the PR itself. Verify issue and PR state before assuming the fork won't act ([auto-route parallel fork](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md)).
- **Filing an upstream issue.** When a `slangpy-<n>/upstream-slang` escalation session runs `gh issue create`, the `issue_opened` webhook mints a second triage session on `gh-issue-shader-slang/slang-<n>` in the same minute (#12070, #12071). The escalation session usually already filed, labeled, set the Issue Type, posted the verdict, dispatched the fixer, and reported up. The webhook session must not re-post, re-label, or re-dispatch. Detect it before mutating: the newest comment is `nv-slang-bot[bot]` from the same minute, `.gh-comments/OWNER-REPO-N.id` exists, or a fixer branch/PR is up. Its value-add is an independent re-verification of the repro at HEAD, reported up. Re-post only if HEAD changed the verdict ([upstream filing triggers duplicate triage](../learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md)).

## REST vs GraphQL, and Misleading Auth Probes

REST label-add (`POST /issues/{n}/labels` or `PATCH /issues/{n}`) can 403 "admin rights" while GraphQL succeeds for the same op ([REST label-add 403, GraphQL succeeds](../learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md)):
```bash
ISSUE_NODE=$(gh api repos/$REPO/issues/$N --jq '.node_id')
LABEL_NODE=$(gh api repos/$REPO/labels/<label-name> --jq '.node_id')
gh api graphql -f query='mutation($lbl:ID!,$lblable:ID!){addLabelsToLabelable(input:{labelableId:$lblable,labelIds:[$lbl]}){labelable{... on Issue{labels(first:10){nodes{name}}}}}}' -f lbl="$LABEL_NODE" -f lblable="$ISSUE_NODE"
```

Closing with a reason via REST `PATCH ... state_reason=duplicate` returns 403, while GraphQL `closeIssue` works (#11719). Skip the REST attempt. This is the opposite polarity from PR self-merge, where REST works and GraphQL 403s ([close as duplicate via GraphQL closeIssue](../learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md)):
```bash
gh api graphql -f query='mutation { closeIssue(input: {issueId: "<NODE_ID>", stateReason: DUPLICATE}) { issue { number state stateReason } } }'
```

`gh auth status` ("token in GH_TOKEN is invalid") and a `gh api user` 401 are known false alarms. Reads, comments, PR creation, pushes and GraphQL mutations all work ([gh auth status false alarm](../learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md), [auth probes misleadingly 401; writes work](../learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md)). Never decide writeability from a probe. Attempt the write; only a GraphQL mutation error payload signals degradation. Only merge-queue enqueue is genuinely blocked.

## Draft PRs and Maintainer Flips

The drafts-only / ready / merge gate constrains the bot. A maintainer with write access may un-draft or merge a bot PR at will. On #11705 a fixer reported "draft-held" while `isDraft:false`, and the timeline showed the maintainer had flipped it. When verified state contradicts a child's claim, relay neither the claim nor a "violation": read the actor first. A bot actor is a real gate concern; a human actor means "maintainer advanced the PR". A child's status line can be stale, so verify load-bearing state (draft/ready, label, head SHA) live. Never let a downstream tier convert a maintainer's flip back to draft ([verify the ready_for_review actor](../learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md)):
```bash
gh api repos/<r>/issues/<pr>/timeline --jq '.[]|select(.event=="ready_for_review" or .event=="convert_to_draft")|"\(.event)\t\(.actor.login)\t\(.created_at)"'
```

## Workflow YAML Pushes

The App push for any `.github/workflows/*.yml` change is rejected server-side ("refusing to allow a GitHub App to create or update workflow ... without 'workflows' permission"). The rejection is final and not retryable. The sanctioned outcome is a ready-to-apply diff posted on the issue, plus a flag that a maintainer must update branch-protection required checks after a rename ([workflow-YAML push is server-rejected](../learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md)). Before concluding "maintainer only", check what the workflow calls. slang#12038's non-ASCII header guard fit inside `extras/formatting.sh`, which `check-formatting.yml` already invokes, so it was bot-shippable with no `.yml` edit ([CI guard bot-shippable via formatting.sh](../learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md)).

## CI Behavior for Bot PRs

- **Draft gate.** `ci.yml:15` (`github.event.pull_request.draft != true`) gates all Slang build/test CI, so draft checks show `skipping`. The `ready_for_review` event re-triggers it, which makes the flip the validation step. slang-rhi behaves the opposite way ([slang gates CI behind non-draft](../learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md)).
- **Lone red `workflow_dispatch`.** When only `wait-for-human-priority` + `check-ci` fail and every build/test job is skipped, the run is a no-op that will never go green. Judge head health from the rollup and/or the auto `pull_request` run ([lone red workflow_dispatch is a no-op](../learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md)).
- **Priority yield.** A `wait-for-human-priority` failure in ~7s with `priority-gate-yielded` means the gate deliberately yielded bot CI to human CI. `retry-yielded-bot-ci` reruns it, and a manual `gh run rerun` fights the gate ([priority gate is self-healing](../learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md)).
- **No CI webhook to the fixer.** A failing check on a bot PR (head branch in `shader-slang/slang`) does not webhook the owning fixer; only review comments and verdicts do. The babysitter surfacing a deterministic red is the fixer's only signal, so don't dismiss it as author-owned the way you would a fork PR. Positive-control `//CHECK:` lines can't be validated locally without FileCheck, so some fixer PRs first fail in CI ([failing CI checks don't webhook the fixer](../learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md)).
- **Already owned.** A deterministic self-inflicted red on a `fix/issue-*` bot PR is usually already in the review→approve→fix loop, because the approver's BLOCK gate often catches it first. Classify it as "owned, in-fix (approver BLOCK'd)", not as a new regression. Don't rerun it or re-surface it each sweep, and treat its test reds as expected until the fix lands. A human PR with the same pattern still gets an "author needs to fix" note (#12122) ([BLOCK'd bot reds are owned](../learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md)).

## PR Ownership: Author Field, Not Title or Branch

Decide "ours" (route to a fixer) versus author-owned (re-confirm silently) by the PR's `author`. An `nv-slang-bot[bot]` author, usually on a `fix/issue-*` branch, means ours. A human author means theirs, even with a `[codex]` title or `codex/*` branch, which only means the human used the tool. PR #11850 (`[codex] Add hash-set pool hysteresis`, a red `check-formatting`) was authored and assigned to a maintainer. The right handling was author-owned, with no route and no "nudge the driver" line ([attribute PR ownership by author](../learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md)).

**Source learnings (32):**

- [Verifying GitHub webhook payloads before acting](../learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md)
- [Always post the PR review when explicitly requested via webhook](../learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md)
- [GitHub bot identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)
- [Auditing missed webhooks via App delivery log](../learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md)
- [Comments under nv-slang-bot[bot] may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)
- [slang repo gates all build/test CI behind non-draft](../learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md)
- [Workflow-YAML rename push is server-rejected](../learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md)
- [CONSOLIDATED GitHub posting policy](../learnings/1781405000000-CONSOLIDATED-github-posting-policy.md)
- [Slang CI wait-for-human-priority gate is self-healing](../learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md)
- [Before reporting a bot-flipped-ready violation, verify the actor](../learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md)
- [Closing issues as duplicate: GraphQL closeIssue, not REST](../learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md)
- [REFINEMENT: comment PATCH is per-token; CREATE is the reliable path](../learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md)
- [Issue-comment login is bare nv-slang-bot: match loosely](../learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md)
- [GitHub login is nv-slang-bot (User): fix edit-if-self matcher](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)
- [REST label-add can 403; GraphQL addLabelsToLabelable succeeds](../learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md)
- [Lone red workflow_dispatch with build/test skipped is a no-op](../learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md)
- [Auto-route parallel triage/fix fork; cross-identity DELETE 403s](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md)
- [Failing CI checks on bot PRs don't webhook the fixer](../learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md)
- [Attribute PR ownership by author field, not title/branch](../learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md)
- [Gated GitHub set is only gh pr ready + merge](../learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md)
- [gh auth status "token invalid" is a false alarm](../learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md)
- [Auth probes misleadingly 401; writes work; GraphQL for labels](../learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md)
- [Non-ASCII header CI guard bot-shippable via formatting.sh](../learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md)
- [Held-no-PR is triage's footprint; fixer hold comment races](../learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md)
- [Bot often can't edit/delete its own comments: prevent](../learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md)
- [Filing an upstream issue triggers a duplicate triage session](../learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md)
- [Edit bot comments via GraphQL updateIssueComment](../learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md)
- [pr_closed/pr_synchronize webhooks are claims: verify live](../learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md)
- [Bot PR reds already BLOCK'd by approver are owned](../learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md)
- [Mermaid flowcharts in GitHub comments: lint + render gotchas](../learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md)
- [Comment edits don't notify: POST fresh when reply must be seen](../learnings/1789477835098-github-comment-edits-don-t-notify-human-questions-.md)
- [Reply auth: mention-response pre-authorized vs gated class](../learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md)
