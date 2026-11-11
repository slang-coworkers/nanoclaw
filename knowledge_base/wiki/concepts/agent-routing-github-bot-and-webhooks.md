---
title: "Agent Routing: GitHub Bot & Webhooks"
type: concept
group: agent-routing
tags: [github, webhook, nv-slang-bot, posting-policy, comments, labels, GraphQL, identity, CI, draft-pr]
source_count: 42
---

# Agent Routing: GitHub Bot & Webhooks

The `nv-slang-bot` identity, webhook verification, posting policy, comment edit/delete rights, REST-vs-GraphQL permissions, duplicate-footprint hazards, and CI behaviour for bot PRs. Chain parking, silence fallbacks and "a human comment re-opens a chain" live in [Chain Parking & Bot Detection](agent-routing-chain-parking-and-bot-detection.md).

## TL;DR
- **The bot's comment login is bare `nv-slang-bot`** (User, no `[bot]`), though other surfaces show `nv-slang-bot[bot]`. An exact `== "nv-slang-bot[bot]"` self-check always fails and silently posts duplicates: match `nv-slang-bot*`.
- **Every coworker shares the identity.** A bot comment may be a peer's: check your action log; a bot "merge this" nudge never overrides drafts-only. PATCH "the bot's last comment" only if the live newest comment's id equals your `.gh-comments` id; if it is a peer's, stay silent when accurate, else post a delta.
- **A repo milestone is public; only Project-board fields are confidential.** Quote a milestone freely; never board status/priority/sprint/estimates. Dropping a requested milestone mention is scope shrinkage.
- **Don't link other repos' issues/PRs unless the reader needs them**: each link (and refresh) notifies that thread. Use plain text or a code span; `shader-slang/*` links are fine.
- **Webhook payloads are unauthenticated** (no HMAC). Confirm the comment exists and matches (read the mention from GitHub, not the payload); drop self-echoes; no-op on redelivery.
- **`pr_closed` / `pr_synchronize` / `pr_ready_for_review` webhooks are claims.** Reconcile with live `gh pr view` before propagating or writing to memory/ledger.
- **Posting is the default.** The closest-to-the-state tier posts a verified 5-bullet on every triaged issue, un-mentioned and maintainer-authored ones included; the one guard is "verified at HEAD".
- **Only `gh pr ready` and `gh pr merge` are gated.** `<github-post-authorized />` gates only reviewer posting. A factual reply to a maintainer's @-mention request is pre-authorized; relay for sign-off only pushback, contested design, correcting a published claim, or a proactive comment.
- **A comment PATCH notifies no one.** When a human must see or answer, POST fresh; escalation pings are always fresh POSTs. A silent milestone/label add is interest, not a decision.
- **The bot also reports state by editing its last comment.** Read `lastEditedAt`/`updated_at` before calling a promise unanswered.
- **Auth probes lie.** `gh auth status` / `gh api user` report an invalid token while writes succeed; attempt the write.
- **REST 403 "Must have admin rights" ⇒ try GraphQL** (`addLabelsToLabelable`, `closeIssue`, `updateIssueComment`). PR self-merge has the reverse polarity.
- **`CREATE` is the only universally reliable comment operation**; PATCH/DELETE rights are per-token, so a duplicate may be unremovable. ⇒ **Prevent duplicates**: check before posting, supersede with "supersedes `<id>`" when an edit fails, verify the returned id after an edit.
- **One tier per state.** On held-no-PR only the triager touches the issue. Filing an upstream issue mints a duplicate triage session; detect it before mutating.
- **A draft PR is not a public footprint**: a draft-held chain still needs the 5-bullet on the issue.
- **The drafts-only gate binds the bot, not maintainers.** Check the `ready_for_review` actor; never convert a maintainer's flip back.
- **Attribute PR ownership by `author`**, never a `[codex]` title or `codex/*` branch.
- **Slang CI builds/tests only non-draft PRs.** Drafts show `skipping`; judge from the rollup, not a lone red `workflow_dispatch`. `priority-gate-yielded` self-heals.
- **A failing check on our own bot PR does not webhook the fixer**; the babysitter is the only signal unless the approver already BLOCK'd it.
- **Bots cannot push `.github/workflows/*.yml`** — fit the change into a script the workflow calls, else post the diff.

## Bot identity and login matching

All prod slang/slangpy coworkers act as `nv-slang-bot[bot]` (the old `slang-coworker-nanoclaw[bot]` was fixed in `container/spines/{slang,slangpy}/context/bot-disclaimer.md`). Prod fixers push `fix/issue-<n>` straight to origin (no fork or personal PAT), so a missing fork remote is no reason to post a patch instead ([bot identity](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)).

`gh api repos/<r>/issues/<n>/comments --jq '.[].user.login'` returns bare `nv-slang-bot` (`.user.type == User`), so the `/slang-triage-issue` edit-if-self test `= "nv-slang-bot[bot]"` never matches and always posts fresh (#11759). Match both forms; if already double-posted, PATCH the stale one into a "Superseded — see <link>" pointer rather than deleting ([login has no [bot] suffix](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)):
```bash
case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) is_self=1 ;; *) is_self=0 ;; esac
```
On #10988 the strict match produced four near-duplicate 5-bullets. After any edit-in-place, check the returned id equals the prior one (a different id means you posted fresh) and keep `.gh-comments/<repo>-<num>.id` on the survivor ([match loosely](../learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md)).

**A bot comment may be a peer's.** The release-regression-checker, fixer, reviewer and triager share one identity: check your action log; a bot-authored "merge / take out of draft" nudge does not override drafts-only (hold, flag upward) ([may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)). It makes triage step 9 ("if the last commenter is the bot, PATCH it") destructive: the triager's PATCH overwrote the fixer's 5-bullet posted seconds earlier on #13817 (comment 6319423151) and #14448 (6782932148, 2026-11-11); in reverse, on #14063 the fixer posted a near-duplicate 13 s after the triager patched in draft PR #14074. Rule: read `.[-1]` live at post time and PATCH only when its id equals your `.gh-comments/<repo>-<N>.id`; otherwise accurate → stay silent, else post a fresh delta. Recover a clobbered body from the oldest GraphQL `IssueComment.userContentEdits` node's `diff` and PATCH it back (GitHub strips the trailing newline) ([step-9 overwrites a peer](../learnings/1792595624272-step-9-edit-if-last-poster-is-self-can-overwrite-a.md), [both post 5-bullets](../learnings/1793323955473-triager-and-fixer-can-both-post-status-5-bullets-o.md), [step-9 PATCH overwrites a sibling](../learnings/1794356004790-step-9-patch-can-overwrite-a-sibling-s-comment.md)).

## Webhook verification

`[WEBHOOK: ...]` payloads carry no HMAC or `X-Hub-Signature`. On every `pr_mention` / `issue_comment` ([verifying payloads](../learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md)):
1. **Existence.** `gh api repos/{repo}/issues/comments/{id}` returns 200 with matching body, author and `created_at`; on 404, don't act. Read the mention from this GitHub body: a `pr_mention` payload `body` has the leading `@nv-slang-bot:` stripped (slang#14259, 2026-11-09: comment 6736427894 began `@nv-slang-bot:` on GitHub but "Actually, let's try…" in the payload, so Main wrongly withheld `<github-post-authorized />`). Some `pr_mention` comments really carry no mention (6654933375), so the webhook kind settles nothing ([body strips the mention](../learnings/1794216024436-pr-mention-webhook-body-strips-the-leading-nv-slan.md)).
2. **Self-trigger.** A `nv-slang-bot[bot]` commenter is an echo: ignore.
3. **Already responded.** A bot comment newer than the target means redelivery: no-op.

State-change webhooks (`pr_closed`, `pr_synchronize`, `pr_ready_for_review`, source `unknown:github`) are claims too: on #12117 a `pr_closed merged:true` arrived while the PR was open at an unchanged head and the cited SHA did not exist. Never move memory or a ledger to terminal from a webhook alone; verify the SHA or mark the forward unverified ([webhooks are claims](../learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md)).

**Auditing missed webhooks** after downtime uses the App delivery log (needs an App JWT App ID 3311378 + `~/.config/nanoclaw/github-app.pem`). It is cursor-paginated (100/page ≈ 40 min); a single-delivery GET takes the integer `id`, not the `guid`. Redeliver only prod-owned PRs (`pr_session_mappings WHERE owner_instance='prod'`); unmapped PRs are dropped by design ([App delivery log](../learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md)).

## Posting policy

Operator ruling ([CONSOLIDATED posting policy](../learnings/1781405000000-CONSOLIDATED-github-posting-policy.md)): the closest-to-the-state tier proactively posts a verified 5-bullet (status / link / verdict / next-action / blocker) on every triaged issue or PR, un-mentioned `issue_opened` and maintainer-authored issues included; silence on an in-flight chain is the bug. The one guard is verified at HEAD (repro reproduced or claims checked against HEAD). `<github-post-authorized />` gates only `/slang-pr-review` posting when a human tagged the bot; reading it as "all writes gated" is retired.

The gated set is exactly `gh pr ready` and `gh pr merge` (re-confirmed on #11898) ([only ready + merge](../learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md)). A factual reply to a maintainer's @-mention request ("synced +36 clean, pushed") is pre-authorized: post it with `gh pr comment`. Relay for sign-off only pushback, contested design, correcting a published claim, or a proactive comment. Adding reviewers or assignees stays off-limits; pushes to your own `fix/issue-*` branch were never gated ([reply auth](../learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md)).

**Tier ownership.** The triager posts the triage 5-bullet; the fixer posts the PR (`Closes #N`, draft until the operator authorizes ready) and verified thread replies; the reviewer posts only when a human tagged the bot, else hands off via `send_file`; the orchestrator never posts for others. An explicit `@nv-slang-bot review` overrides the read-only `/slang-pr-review` default: route `final-review.md` to a coworker with `pull_requests: write` ([post when requested](../learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md)).

**Edits don't notify.** A PATCH pings neither the @-mentioned user nor subscribers; a fresh POST's @-mention (or a review-thread reply) does. "On it" then PATCHing in the answer pings only for "on it", and the thread reads as unanswered to the human and to a "human spoke last" supervisor (#12919); PATCH only a live TODO the human needn't act on ([edits don't notify](../learnings/1789477835098-github-comment-edits-don-t-notify-human-questions-.md)). This overrides "edit in place if the bot was last" when the delta must wake a named human: a 72h-cap escalation @-mention is a fresh short POST even when the bot posted last (slangpy#163). A silent milestone/label add (#163 put on "Q4 2026 (Fall)") shows interest, not a decision; when `updated_at` moves with no comment, read `/issues/N/timeline` ([escalation = fresh POST](../learnings/1792550010100-escalation-mentions-must-be-a-fresh-post-even-when.md)). After the fresh POST, PATCH the stale status comment to point at it and correct its facts (slangpy#1234) ([rider: PATCH the stale status](../learnings/1793026171832-who-approved-an-action-required-fork-ci-run-trigge.md)). Likewise when a coordinator asks for an in-place update but a human commented after the bot (#14103: the reporter asked "@nv-slang-bot please generate a draft PR"; an edit above it leaves no visible answer): check the newest author live, edit only if it is the bot, and state the deviation in the report up ([fresh delta after a human](../learnings/1793395604259-issue-comment-routing-post-a-fresh-delta-when-a-hu.md)).

**In-place status edits.** No timeline event at the `updated_at` time means a comment was edited, and the bot reports its own state that way: on slang#13909 the 07:43Z "handed to a fixer" comment became, at 09:03Z, "our fixer opened no PR; verified the reporter's PR #13927", and a sweep reading only new comments nearly re-asked the fleet to stop the fixer. Read `lastEditedAt` on the bot's last comment (GraphQL `comments{nodes{createdAt lastEditedAt body}}`, or REST `updated_at`) first ([status via in-place edits](../learnings/1793003521449-bot-status-changes-can-arrive-as-in-place-comment-.md)).

**Cross-repo links notify outsiders (operator, 2026-10-22).** `owner/repo#N` or a `github.com/.../issues|pull/N` URL in any issue, PR, comment or commit body cross-references that thread, and every edit or auto-refresh re-sends it: microsoft/mimalloc#1075, linked from the slang#13827 triage and PR #13850's explanation, was re-pinged by the fixer's auto-refresh 37 s after a maintainer deleted the explanation. Describe upstream changes in plain text (SHAs, paths, versions in backticks), link only when the reader cannot act without it, code-span an identifier that must not ping, and check auto-refreshed artifacts before each refresh ([don't link other repos](../learnings/1792634844580-github-posts-don-t-link-other-repos-issues-prs-unl.md)).

**Milestones yes, Project-board fields no.** Confidentiality covers GitHub **Project** fields only; a repo milestone is visible in the sidebar and quotable. On slang#13877 a triager dropped a parent-requested milestone mention "to be safe"; codex OUTPUT_REVIEW flagged it must-fix. Byte trap from the same edit: `gh api ... --jq .body > file` appends a newline, so a PATCH with `-F body=@file` adds `\n`; compare against the JSON `.body` (Python `json.load`) for a byte-exact edit ([milestones are public](../learnings/1793286449078-issue-milestones-are-public-not-confidential-proje.md)).

**Mermaid diagrams.** No `mmdc` in-container: lint structurally (bracket balance, even quotes, every `style`/edge id declared, `&lt;`/`&gt;` in labels), avoid `-.-x` edges, and keep drafts in the base clone (a `wt-slang-<n>/` worktree can be reaped) ([mermaid gotchas](../learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md)).

## Comment edit / delete rights

PATCH rights are per token. On #11718 the triager token edited its own comment but 403'd on a peer's, the fixer token 403'd on its own repeatably while CREATE worked, and cross-author PATCH always 403s. "Must have admin rights to Repository" is GitHub's generic "this token can't edit this comment", not transient; the reliable remedy is a fresh CREATE leading with "supersedes `<id>`" ([PATCH is per-token](../learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md)). The `[bot]`-login container got 403 on PATCH and DELETE of its own comment (the bare-login one could PATCH its own), so a duplicate can be unremovable: verify before posting, accept two non-contradictory footprints, and don't burn turns on a doomed PATCH/DELETE ([often cannot edit/delete](../learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md)).

Before concluding "no edit permission" from a REST 403, try GraphQL: `updateIssueComment` worked with the babysitter's App token where REST PATCH 403'd (#11951). Take `node_id` from `gh api repos/O/R/issues/comments/<id> --jq .node_id`, run `mutation($id:ID!,$body:String!){updateIssueComment(input:{id:$id,body:$body}){issueComment{id url}}}`, re-read the body ([GraphQL updateIssueComment](../learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md)).

## Duplicate-footprint hazards

Cleanup is unreliable, so each is prevented upstream:
- **Held-no-PR belongs to triage.** On a design-gated refusal or won't-fix only the triager touches the issue, by editing its comment. On #12051 a fixer's self-posted hold landed 32 s after the triager's; the fixer pings the triager instead ([held-no-PR is triage's](../learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md)).
- **Auto-route forks.** The UserPromptSubmit auto-route hook can spawn a parallel fork running the same workflow (#11751: three bot comments, and it opened the PR). Verify issue/PR state before assuming it won't act; cross-identity DELETE 403s, so expect a leftover `[bot]` duplicate ([auto-route fork](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md)).
- **Filing an upstream issue.** When a `slangpy-<n>/upstream-slang` session runs `gh issue create`, the `issue_opened` webhook mints a second triage session on `gh-issue-shader-slang/slang-<n>` in the same minute (#12070, #12071), though the escalation session usually already did the whole triage. The webhook session detects this (newest comment is the bot's from that minute, `.gh-comments/OWNER-REPO-N.id` exists, or a fixer branch/PR is up), adds only an independent HEAD re-verification reported up, and re-posts only if HEAD changed the verdict ([upstream filing → duplicate triage](../learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md)).

## REST vs GraphQL, and misleading auth probes

REST label-add (`POST /issues/{n}/labels` or `PATCH /issues/{n}`) can 403 "admin rights" while GraphQL succeeds ([label-add via GraphQL](../learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md)):
```bash
ISSUE_NODE=$(gh api repos/$REPO/issues/$N --jq '.node_id')
LABEL_NODE=$(gh api repos/$REPO/labels/<label-name> --jq '.node_id')
gh api graphql -f query='mutation($lbl:ID!,$lblable:ID!){addLabelsToLabelable(input:{labelableId:$lblable,labelIds:[$lbl]}){labelable{... on Issue{labels(first:10){nodes{name}}}}}}' -f lbl="$LABEL_NODE" -f lblable="$ISSUE_NODE"
```

REST `PATCH ... state_reason=duplicate` 403s while GraphQL `closeIssue` works (#11719), the opposite polarity from PR self-merge (REST works, GraphQL 403s). Closing is human-only by default (see [GitHub PR and Bot Operations](general-misc-github-pr-and-bot-operations.md)); this applies when a human directs it ([closeIssue](../learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md)):
```bash
gh api graphql -f query='mutation { closeIssue(input: {issueId: "<NODE_ID>", stateReason: DUPLICATE}) { issue { number state stateReason } } }'
```

`gh auth status` ("token in GH_TOKEN is invalid") and a `gh api user` 401 are known false alarms; reads, comments, PR creation, pushes and GraphQL mutations all work ([auth status false alarm](../learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md), [probes 401; writes work](../learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md)). Never judge writeability from a probe; only a GraphQL mutation error payload signals degradation. Only merge-queue enqueue is truly blocked.

## Draft PRs and maintainer flips

The drafts-only / ready / merge gate constrains the bot; a maintainer may un-draft or merge a bot PR at will. On #11705 a fixer reported "draft-held" while `isDraft:false`: the maintainer had flipped it. When verified state contradicts a child's claim, relay neither the claim nor a "violation": read the actor (bot = gate concern; human = "maintainer advanced the PR"). Verify load-bearing state live (child status lines go stale), and never let a downstream tier revert a maintainer's flip ([verify the actor](../learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md)):
```bash
gh api repos/<r>/issues/<pr>/timeline --jq '.[]|select(.event=="ready_for_review" or .event=="convert_to_draft")|"\(.event)\t\(.actor.login)\t\(.created_at)"'
```

## Workflow YAML pushes

An App push changing `.github/workflows/*.yml` is rejected server-side ("refusing to allow a GitHub App to create or update workflow ... without 'workflows' permission"). The sanctioned outcome is a ready-to-apply diff on the issue, flagging that a maintainer must update required checks after a rename ([workflow-YAML push rejected](../learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md)). First check what the workflow calls: slang#12038's non-ASCII header guard fit inside `extras/formatting.sh`, which `check-formatting.yml` already invokes, so it shipped with no `.yml` edit ([shippable via formatting.sh](../learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md)).

## CI behaviour for bot PRs

- **Draft gate.** `ci.yml:15` (`github.event.pull_request.draft != true`) gates all Slang build/test CI, so drafts show `skipping`; `ready_for_review` re-triggers it, making the flip the validation step. slang-rhi behaves the opposite way ([CI behind non-draft](../learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md)).
- **Lone red `workflow_dispatch`.** When only `wait-for-human-priority` + `check-ci` fail and every build/test job is skipped, the run is a no-op that never goes green: judge from the rollup and the auto `pull_request` run ([lone red dispatch](../learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md)).
- **Priority yield.** `wait-for-human-priority` failing in ~7 s with `priority-gate-yielded` means bot CI yielded to human CI; `retry-yielded-bot-ci` reruns it, and a manual `gh run rerun` fights the gate ([self-healing gate](../learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md)).
- **No CI webhook to the fixer.** A failing check on a bot PR does not webhook the owning fixer (only review comments and verdicts do); the babysitter surfacing a deterministic red is the only signal, so don't dismiss it as author-owned. Positive-control `//CHECK:` lines can't be validated locally without FileCheck, so some fixer PRs first fail in CI ([CI doesn't webhook the fixer](../learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md)).
- **Already owned.** A deterministic self-inflicted red on a `fix/issue-*` bot PR is usually already in the review→approve→fix loop via the approver's BLOCK: classify "owned, in-fix (approver BLOCK'd)"; don't rerun or re-surface it each sweep. A human PR with the same pattern still gets an "author needs to fix" note (#12122) ([BLOCK'd reds are owned](../learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md)).

## PR ownership: author field, not title or branch

"Ours" (route to a fixer) versus author-owned (re-confirm silently) is decided by `author`. `nv-slang-bot[bot]`, usually on `fix/issue-*`, is ours; a human author is theirs even with a `[codex]` title or `codex/*` branch. PR #11850 (`[codex] Add hash-set pool hysteresis`, red `check-formatting`) belonged to a maintainer: no route, no "nudge the driver" line ([ownership by author](../learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md)).

**Source learnings (42):**
- [Step-9 edit-if-self overwrites a peer's comment](../learnings/1792595624272-step-9-edit-if-last-poster-is-self-can-overwrite-a.md) — #13817; `userContentEdits`.
- [Don't link other repos' issues/PRs](../learnings/1792634844580-github-posts-don-t-link-other-repos-issues-prs-unl.md) — mimalloc#1075 re-pinged.
- [Triager and fixer both post 5-bullets](../learnings/1793323955473-triager-and-fixer-can-both-post-status-5-bullets-o.md) — #14063; check `.[-1]`.
- [Step-9 PATCH overwrites a sibling](../learnings/1794356004790-step-9-patch-can-overwrite-a-sibling-s-comment.md) — #14448; idfile match.
- [Verifying webhook payloads](../learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md) — existence, echo, redelivery.
- [pr_mention body strips the @nv-slang-bot](../learnings/1794216024436-pr-mention-webhook-body-strips-the-leading-nv-slan.md) — read the GitHub body.
- [Post the PR review when requested](../learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md) — `pull_requests: write` holder.
- [Bot identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md) — push to origin.
- [Missed webhooks via App delivery log](../learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md) — App JWT; integer id.
- [Bot comments may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md) — check your action log.
- [Slang CI only on non-draft](../learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md) — `ci.yml:15`.
- [Workflow-YAML push server-rejected](../learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md) — post a diff.
- [CONSOLIDATED posting policy](../learnings/1781405000000-CONSOLIDATED-github-posting-policy.md) — post by default.
- [Priority gate self-heals](../learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md) — no manual rerun.
- [Verify the ready-flip actor](../learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md) — #11705.
- [Close as duplicate via GraphQL](../learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md) — REST 403s.
- [REFINEMENT: PATCH per-token; CREATE reliable](../learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md) — #11718.
- [Bare login: match loosely](../learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md) — #10988; verify id.
- [Login is User: fix the matcher](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md) — #11759.
- [REST label-add 403; GraphQL works](../learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md) — `addLabelsToLabelable`.
- [Lone red workflow_dispatch is a no-op](../learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md) — use the rollup.
- [Auto-route parallel fork](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md) — #11751.
- [CI doesn't webhook the fixer](../learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md) — babysitter signal.
- [PR ownership by author](../learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md) — #11850.
- [Gated: only ready + merge](../learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md) — #11898.
- [gh auth status false alarm](../learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md) — writes work.
- [Auth probes 401; writes work](../learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md) — attempt the write.
- [CI guard via formatting.sh](../learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md) — no `.yml` edit.
- [Held-no-PR is triage's](../learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md) — #12051.
- [Often can't edit/delete own comments](../learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md) — prevent.
- [Upstream filing → duplicate triage](../learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md) — re-verify only.
- [GraphQL updateIssueComment](../learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md) — where REST 403'd.
- [Webhooks are claims](../learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md) — #12117.
- [BLOCK'd bot reds are owned](../learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md) — don't re-surface.
- [Mermaid lint gotchas](../learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md) — no mmdc.
- [Comment edits don't notify](../learnings/1789477835098-github-comment-edits-don-t-notify-human-questions-.md) — POST fresh.
- [Reply auth: pre-authorized vs gated](../learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md) — sign-off cases.
- [Escalation @mentions: fresh POST](../learnings/1792550010100-escalation-mentions-must-be-a-fresh-post-even-when.md) — slangpy#163.
- [Status via in-place edits](../learnings/1793003521449-bot-status-changes-can-arrive-as-in-place-comment-.md) — `lastEditedAt`.
- [Fresh delta after a human](../learnings/1793395604259-issue-comment-routing-post-a-fresh-delta-when-a-hu.md) — #14103.
- [Rider: PATCH the stale status](../learnings/1793026171832-who-approved-an-action-required-fork-ci-run-trigge.md) — pointer + facts.
- [Milestones are public](../learnings/1793286449078-issue-milestones-are-public-not-confidential-proje.md) — `> file` adds `\n`.
