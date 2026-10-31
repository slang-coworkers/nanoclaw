---
title: "Agent Routing: GitHub Bot & Webhooks"
type: concept
group: agent-routing
tags: [github, webhook, nv-slang-bot, posting-policy, comments, labels, GraphQL, identity, CI, draft-pr]
source_count: 40
---

# Agent Routing: GitHub Bot & Webhooks

The `nv-slang-bot` identity, webhook verification, posting policy, comment edit/delete rights, REST-vs-GraphQL permissions, duplicate-footprint hazards, and CI behaviour for bot PRs. Chain parking, silence fallbacks and "a human comment re-opens a chain" live in [Chain Parking & Bot Detection](agent-routing-chain-parking-and-bot-detection.md).

## TL;DR
- **The bot's comment login is bare `nv-slang-bot`** (User, no `[bot]`), though other surfaces show `nv-slang-bot[bot]`. An exact `== "nv-slang-bot[bot]"` self-check always fails and silently posts duplicates: match `nv-slang-bot*`.
- **Every coworker shares the identity.** A bot comment on your PR may be a peer's; check your own action log, and never let a bot-authored "merge this" nudge override drafts-only. Before PATCHing "the bot's last comment", read the newest comment live and compare its id with your `.gh-comments` id; if it is a peer's, PATCH it only carrying its state, and repoint the idfile.
- **A repo milestone is public; only Project-board fields are confidential.** Quote a milestone freely; never board status/priority/sprint/estimates. Dropping a requested milestone mention is scope shrinkage.
- **Don't link other repos' issues/PRs unless the reader needs them** — each link (and each refresh) notifies that thread. Use plain text or a code span; `shader-slang/*` links are fine.
- **Webhook payloads are unauthenticated** (no HMAC). Confirm the comment exists and matches; drop self-echoes; no-op on redelivery.
- **`pr_closed` / `pr_synchronize` / `pr_ready_for_review` webhooks are claims.** Reconcile with live `gh pr view` before propagating or writing to memory/ledger.
- **Posting is the default.** The closest-to-the-state tier posts a verified 5-bullet on every triaged issue, un-mentioned and maintainer-authored ones included; the one guard is "verified at HEAD".
- **Only `gh pr ready` and `gh pr merge` are gated.** `<github-post-authorized />` gates only reviewer posting. A factual reply to a maintainer's @-mention request is pre-authorized; relay for sign-off only pushback, contested design, correcting a published claim, or a proactive comment.
- **A comment PATCH notifies no one.** When a human must see or answer, POST fresh; escalation pings are always fresh POSTs. Edit in place only if the newest comment, checked live, is the bot's. A silent milestone/label add is interest, not a decision.
- **The bot also reports state by editing its last comment.** Read `lastEditedAt`/`updated_at` before calling a promise unanswered.
- **Auth probes lie.** `gh auth status` / `gh api user` report an invalid token while writes succeed; attempt the write.
- **REST 403 "Must have admin rights" ⇒ try GraphQL** (`addLabelsToLabelable`, `closeIssue`, `updateIssueComment`). PR self-merge has the reverse polarity.
- **`CREATE` is the only universally reliable comment operation**; PATCH/DELETE rights are per-token, so a duplicate may be unremovable. ⇒ **Prevent duplicates**: check before posting, supersede with "supersedes `<id>`" when an edit fails, verify the returned id after an edit.
- **One tier per state.** On held-no-PR only the triager touches the issue. Filing an upstream issue mints a duplicate triage session; detect it before mutating.
- **A draft PR is not a public footprint** — a draft-held chain still needs the 5-bullet on the issue.
- **The drafts-only gate binds the bot, not maintainers.** Check the `ready_for_review` actor; never convert a maintainer's flip back.
- **Attribute PR ownership by `author`**, never a `[codex]` title or `codex/*` branch.
- **Slang CI builds/tests only non-draft PRs.** Drafts show `skipping`; judge from the rollup, not a lone red `workflow_dispatch`. `priority-gate-yielded` self-heals.
- **A failing check on our own bot PR does not webhook the fixer**; the babysitter is the only signal unless the approver already BLOCK'd it.
- **Bots cannot push `.github/workflows/*.yml`** — fit the change into a script the workflow calls, else post the diff.

## Bot identity and login matching

All prod slang/slangpy coworkers act as `nv-slang-bot[bot]`; the old `slang-coworker-nanoclaw[bot]` was fixed in `container/spines/{slang,slangpy}/context/bot-disclaimer.md`. Prod fixers push `fix/issue-<n>` straight to origin — no fork, no personal PAT — so "no fork remote" is no reason to fall back to posting a patch ([bot identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)).

`gh api repos/<r>/issues/<n>/comments --jq '.[].user.login'` returns bare `nv-slang-bot` (`.user.type == User`), so the `/slang-triage-issue` edit-if-self test `= "nv-slang-bot[bot]"` never matches and always posts fresh (#11759). Match both forms; if already double-posted, PATCH the stale one into a "Superseded — see <link>" pointer rather than deleting ([login has no [bot] suffix](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)):
```bash
case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) is_self=1 ;; *) is_self=0 ;; esac
```
On #10988 the strict match produced four near-duplicate 5-bullets. After any edit-in-place, check the returned id equals the prior one (a different id means you posted fresh) and keep `.gh-comments/<repo>-<num>.id` on the survivor ([edit-in-place check must match loosely](../learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md)).

The release-regression-checker, fixer, reviewer and triager all post as one identity, so a bot comment on your PR may not be yours; check your action log. A bot-authored "merge / take out of draft" nudge does not override drafts-only: hold and flag the conflict upward ([bot comments may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)). The same sharing makes triage step 9 ("if the last commenter is the bot, PATCH it") destructive: on #13817 the fixer posted its 5-bullet (comment 6319423151) 4 s before the triager's PATCH overwrote it; the original came back from GraphQL `IssueComment.userContentEdits`. Before PATCHing, compare the last bot comment's id with your stored id; if they differ, a peer wrote it — edit only when your text carries its state, else post a fresh delta ([step-9 edit-if-self can overwrite a peer bot's comment](../learnings/1792595624272-step-9-edit-if-last-poster-is-self-can-overwrite-a.md)). The race runs the other way too: on #14063 the triager patched its comment to point at draft PR #14074 and 13 s later the fixer posted a near-duplicate. So run the step-9 check (`.[-1]` of the comments) at post time, never from a cached idfile; when the newest comment is the bot's, PATCH it (whoever posted it), carry its state, and repoint your idfile ([triager and fixer can both post status 5-bullets](../learnings/1793323955473-triager-and-fixer-can-both-post-status-5-bullets-o.md)).

## Webhook verification

`[WEBHOOK: ...]` payloads carry no HMAC or `X-Hub-Signature`. On every `pr_mention` / `issue_comment` ([verifying webhook payloads](../learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md)):
1. **Existence.** `gh api repos/{repo}/issues/comments/{id}` returns 200 with matching body, author and `created_at`; on 404, don't act.
2. **Self-trigger.** A `nv-slang-bot[bot]` commenter is an echo: ignore.
3. **Already responded.** A bot comment newer than the target means redelivery: no-op.

State-change webhooks (`pr_closed`, `pr_synchronize`, `pr_ready_for_review`, source `unknown:github`) are claims too. On #12117 a `pr_closed merged:true` arrived while GitHub showed the PR open at an unchanged head and the cited SHA did not exist. Never move memory or a ledger to terminal from a webhook alone; verify the SHA or mark the forward unverified ([pr_closed/pr_synchronize are claims](../learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md)).

**Auditing missed webhooks** after downtime uses the App delivery log, which needs an App JWT (App ID 3311378 + `~/.config/nanoclaw/github-app.pem`). It is cursor-paginated (100/page ≈ 40 min), and a single-delivery GET takes the integer `id`, not the `guid`. Redeliver only prod-owned PRs (`pr_session_mappings WHERE owner_instance='prod'`); unmapped PRs are dropped by design ([audit via App delivery log](../learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md)).

## Posting policy

The operator ruling ([CONSOLIDATED posting policy](../learnings/1781405000000-CONSOLIDATED-github-posting-policy.md)): nv-slang-bot has posting authority; the closest-to-the-state tier proactively posts a verified 5-bullet (status / link / verdict / next-action / blocker) on every triaged issue or PR, including un-mentioned `issue_opened` and maintainer-authored issues — silence on an in-flight chain is the bug. The one guard is verified at HEAD (repro reproduced or claims checked against HEAD). `<github-post-authorized />` gates only `/slang-pr-review` posting when a human tagged the bot; reading it as "all writes gated" is retired.

The gated set is exactly `gh pr ready` and `gh pr merge` (re-confirmed on #11898) ([gated set is only ready + merge](../learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md)). A factual reply to a maintainer's @-mention request ("synced +36 clean, pushed") is pre-authorized: post it with `gh pr comment`. Relay for sign-off only pushback, contested design, correcting a published claim, or a proactive comment. Adding reviewers or assignees stays off-limits; pushes to your own `fix/issue-*` branch were never gated ([reply auth: pre-authorized vs gated class](../learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md)).

**Tier ownership.** The triager posts the triage 5-bullet; the fixer posts the PR (`Closes #N`, draft until the operator authorizes ready) and verified thread replies; the reviewer posts only when a human tagged the bot, else hands off via `send_file`; the orchestrator never posts on others' behalf. An explicit `@nv-slang-bot review` overrides the read-only `/slang-pr-review` default: route `final-review.md` to a coworker with `pull_requests: write` ([post review when explicitly requested](../learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md)).

**Edits don't notify.** A PATCH pings neither the @-mentioned user nor subscribers; a fresh POST's @-mention (or a review-thread reply) does. Posting "on it" then PATCHing in the answer pings the human only for "on it", and the thread reads as unanswered to them and to a "human spoke last" supervisor (#12919). PATCH only a live TODO the human needn't act on ([comment edits don't notify](../learnings/1789477835098-github-comment-edits-don-t-notify-human-questions-.md)). This overrides "edit in place if the bot was last" whenever the delta exists to wake a named human: a 72h-cap escalation @-mention is a fresh short POST even when the bot posted last (slangpy#163). A silent milestone or label add (#163 put on "Q4 2026 (Fall)") shows interest, not a decision on an open design question; when `updated_at` moves with no comment, read `/issues/N/timeline` ([escalation @mentions must be a fresh POST](../learnings/1792550010100-escalation-mentions-must-be-a-fresh-post-even-when.md)). After the fresh POST, PATCH the stale status comment to point at it and correct its facts (slangpy#1234) ([rider: PATCH the stale status comment after a fresh POST](../learnings/1793026171832-who-approved-an-action-required-fork-ci-run-trigge.md)). Likewise when a coordinator asks for an in-place update but a human commented after the bot: on #14103 the reporter had asked "@nv-slang-bot please generate a draft PR", and an edit above their reply would have left no visible answer. Check the newest author live, edit only if it is the bot, and state the deviation in the report up ([post a fresh delta when a human commented since](../learnings/1793395604259-issue-comment-routing-post-a-fresh-delta-when-a-hu.md)).

If the timeline has no event at the `updated_at` time, a comment was edited — and the bot reports its own state changes that way. On slang#13909 the 07:43Z "handed to a fixer" comment was edited at 09:03Z to "our fixer opened no PR; verified the reporter's PR #13927"; a sweep reading only new comments nearly re-asked the fleet to stop the fixer. Read `lastEditedAt` on the bot's last comment (GraphQL `comments{nodes{createdAt lastEditedAt body}}`, or REST `updated_at`) first ([bot status changes can arrive as in-place edits](../learnings/1793003521449-bot-status-changes-can-arrive-as-in-place-comment-.md)).

**Cross-repo links notify outsiders (operator, 2026-10-22).** `owner/repo#N` or a `github.com/.../issues|pull/N` URL in any issue, PR, comment or commit body posts a cross-reference on that thread, and every edit or auto-refresh re-sends it. microsoft/mimalloc#1075 was linked from the slang#13827 triage and the PR #13850 explanation comment; a maintainer deleted the explanation and the fixer's auto-refresh re-posted it 37 s later. Describe upstream changes in plain text (SHAs, paths, versions in backticks), link only when the reader cannot act without it, use a code span for an identifier that must not ping, and check auto-refreshed artifacts before each refresh ([don't link other repos' issues/PRs unless needed](../learnings/1792634844580-github-posts-don-t-link-other-repos-issues-prs-unl.md)).

**Milestones yes, Project-board fields no.** The confidentiality rule covers GitHub **Project** fields only; a repo milestone is visible in the sidebar and quotable. On slang#13877 a triager dropped a parent-requested milestone mention "to be safe" and codex OUTPUT_REVIEW flagged it must-fix. Byte trap from the same edit: `gh api ... --jq .body > file` appends a newline, so a PATCH with `-F body=@file` adds `\n`; compare against the JSON `.body` (Python `json.load`) for a byte-exact edit ([milestones are public, not Project-board fields](../learnings/1793286449078-issue-milestones-are-public-not-confidential-proje.md)).

**Mermaid diagrams.** No `mmdc` in-container, so lint structurally: bracket balance, even quotes, every `style`/edge id declared, `&lt;`/`&gt;` in labels. Avoid `-.-x` edges. Keep drafts in the base clone; a `wt-slang-<n>/` worktree can be reaped ([mermaid lint + render gotchas](../learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md)).

## Comment edit / delete rights

PATCH rights are per token. On #11718 the triager token edited its own comment and 403'd on a peer's; the fixer token 403'd on its own comments repeatably while CREATE worked; cross-author PATCH always 403s. "Must have admin rights to Repository" is GitHub's generic "this token can't edit this comment", not transient. The reliable remedy is a fresh CREATE leading with "supersedes `<id>`" ([PATCH is per-token; CREATE is the reliable path](../learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md)). The `[bot]`-login container got 403 on both PATCH and DELETE of its own comment, while the bare-login container could PATCH its own, so a duplicate can be unremovable by anyone: verify before posting, accept two non-contradictory footprints, and don't burn turns on a doomed PATCH/DELETE ([often cannot edit/delete own comments: prevent](../learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md)).

Before concluding "no edit permission" from a REST 403, try GraphQL: `updateIssueComment` worked with the babysitter's App token where REST PATCH 403'd (#11951). Take `node_id` from `gh api repos/O/R/issues/comments/<id> --jq .node_id`, run `mutation($id:ID!,$body:String!){updateIssueComment(input:{id:$id,body:$body}){issueComment{id url}}}`, re-read the body ([edit via GraphQL updateIssueComment](../learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md)).

## Duplicate-footprint hazards

Cleanup is unreliable, so each is prevented upstream:
- **Held-no-PR belongs to triage.** On a design-gated refusal or won't-fix only the triager touches the issue, by editing its comment. On #12051 a fixer's self-posted hold landed 32 s after the triager's; the fixer pings the triager instead ([held-no-PR is triage's footprint](../learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md)).
- **Auto-route forks.** The UserPromptSubmit auto-route hook can spawn a parallel fork running the same workflow; on #11751 it left three bot comments and opened the PR itself. Verify issue/PR state before assuming it won't act. Cross-identity DELETE also 403s, so expect a leftover `[bot]` duplicate ([auto-route parallel fork; cross-identity DELETE 403s](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md)).
- **Filing an upstream issue.** When a `slangpy-<n>/upstream-slang` session runs `gh issue create`, the `issue_opened` webhook mints a second triage session on `gh-issue-shader-slang/slang-<n>` in the same minute (#12070, #12071). The escalation session usually already filed, labelled, set the Type, posted, dispatched and reported. The webhook session detects this (newest comment is the bot's from that minute, `.gh-comments/OWNER-REPO-N.id` exists, or a fixer branch/PR is up), adds only an independent HEAD re-verification reported up, and re-posts only if HEAD changed the verdict ([upstream filing triggers duplicate triage](../learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md)).

## REST vs GraphQL, and misleading auth probes

REST label-add (`POST /issues/{n}/labels` or `PATCH /issues/{n}`) can 403 "admin rights" while GraphQL succeeds ([REST label-add 403, GraphQL succeeds](../learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md)):
```bash
ISSUE_NODE=$(gh api repos/$REPO/issues/$N --jq '.node_id')
LABEL_NODE=$(gh api repos/$REPO/labels/<label-name> --jq '.node_id')
gh api graphql -f query='mutation($lbl:ID!,$lblable:ID!){addLabelsToLabelable(input:{labelableId:$lblable,labelIds:[$lbl]}){labelable{... on Issue{labels(first:10){nodes{name}}}}}}' -f lbl="$LABEL_NODE" -f lblable="$ISSUE_NODE"
```

REST `PATCH ... state_reason=duplicate` 403s while GraphQL `closeIssue` works (#11719) — the opposite polarity from PR self-merge, where REST works and GraphQL 403s. Closing is itself human-only by default (see [GitHub PR and Bot Operations](general-misc-github-pr-and-bot-operations.md)); this mechanic applies when a human directs it ([close as duplicate via GraphQL closeIssue](../learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md)):
```bash
gh api graphql -f query='mutation { closeIssue(input: {issueId: "<NODE_ID>", stateReason: DUPLICATE}) { issue { number state stateReason } } }'
```

`gh auth status` ("token in GH_TOKEN is invalid") and a `gh api user` 401 are known false alarms; reads, comments, PR creation, pushes and GraphQL mutations all work ([gh auth status false alarm](../learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md), [auth probes misleadingly 401; writes work](../learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md)). Never decide writeability from a probe; only a GraphQL mutation error payload signals degradation. Only merge-queue enqueue is genuinely blocked.

## Draft PRs and maintainer flips

The drafts-only / ready / merge gate constrains the bot; a maintainer may un-draft or merge a bot PR at will. On #11705 a fixer reported "draft-held" while `isDraft:false`; the timeline showed the maintainer had flipped it. When verified state contradicts a child's claim, relay neither the claim nor a "violation": read the actor (bot = gate concern; human = "maintainer advanced the PR"). Child status lines can be stale, so verify load-bearing state live, and never let a downstream tier revert a maintainer's flip ([verify the ready_for_review actor](../learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md)):
```bash
gh api repos/<r>/issues/<pr>/timeline --jq '.[]|select(.event=="ready_for_review" or .event=="convert_to_draft")|"\(.event)\t\(.actor.login)\t\(.created_at)"'
```

## Workflow YAML pushes

An App push changing `.github/workflows/*.yml` is rejected server-side ("refusing to allow a GitHub App to create or update workflow ... without 'workflows' permission"), finally. The sanctioned outcome is a ready-to-apply diff on the issue, plus a flag that a maintainer must update required checks after a rename ([workflow-YAML push is server-rejected](../learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md)). First check what the workflow calls: slang#12038's non-ASCII header guard fit inside `extras/formatting.sh`, which `check-formatting.yml` already invokes, so it shipped with no `.yml` edit ([CI guard bot-shippable via formatting.sh](../learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md)).

## CI behaviour for bot PRs

- **Draft gate.** `ci.yml:15` (`github.event.pull_request.draft != true`) gates all Slang build/test CI, so drafts show `skipping`; `ready_for_review` re-triggers it, making the flip the validation step. slang-rhi behaves the opposite way ([slang gates CI behind non-draft](../learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md)).
- **Lone red `workflow_dispatch`.** When only `wait-for-human-priority` + `check-ci` fail and every build/test job is skipped, the run is a no-op that never goes green; judge from the rollup and the auto `pull_request` run ([lone red workflow_dispatch is a no-op](../learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md)).
- **Priority yield.** `wait-for-human-priority` failing in ~7 s with `priority-gate-yielded` means bot CI yielded to human CI; `retry-yielded-bot-ci` reruns it, and a manual `gh run rerun` fights the gate ([priority gate is self-healing](../learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md)).
- **No CI webhook to the fixer.** A failing check on a bot PR does not webhook the owning fixer; only review comments and verdicts do. The babysitter surfacing a deterministic red is the only signal, so don't dismiss it as author-owned. Positive-control `//CHECK:` lines can't be validated locally without FileCheck, so some fixer PRs first fail in CI ([failing CI checks don't webhook the fixer](../learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md)).
- **Already owned.** A deterministic self-inflicted red on a `fix/issue-*` bot PR is usually already in the review→approve→fix loop via the approver's BLOCK. Classify "owned, in-fix (approver BLOCK'd)"; don't rerun or re-surface it each sweep. A human PR with the same pattern still gets an "author needs to fix" note (#12122) ([BLOCK'd bot reds are owned](../learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md)).

## PR ownership: author field, not title or branch

"Ours" (route to a fixer) versus author-owned (re-confirm silently) is decided by `author`. `nv-slang-bot[bot]`, usually on `fix/issue-*`, is ours; a human author is theirs even with a `[codex]` title or `codex/*` branch. PR #11850 (`[codex] Add hash-set pool hysteresis`, red `check-formatting`) belonged to a maintainer: no route, no "nudge the driver" line ([attribute PR ownership by author](../learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md)).

**Source learnings (40):**
- [Step-9 edit-if-self can overwrite a peer bot's fresh comment](../learnings/1792595624272-step-9-edit-if-last-poster-is-self-can-overwrite-a.md) — #13817; compare stored id; `userContentEdits`.
- [Don't link other repos' issues/PRs unless needed](../learnings/1792634844580-github-posts-don-t-link-other-repos-issues-prs-unl.md) — mimalloc#1075 re-pinged by auto-refresh.
- [Triager and fixer can both post status 5-bullets](../learnings/1793323955473-triager-and-fixer-can-both-post-status-5-bullets-o.md) — #14063; check `.[-1]` at post time.
- [Verifying GitHub webhook payloads before acting](../learnings/1778861861601-verifying-github-webhook-payloads-before-acting.md) — existence, self-echo, redelivery.
- [Post the PR review when explicitly requested](../learnings/1779963510190-always-post-the-pr-review-when-explicitly-requeste.md) — route to a `pull_requests: write` holder.
- [GitHub bot identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md) — old name stale; push to origin.
- [Auditing missed webhooks via App delivery log](../learnings/1780724000000-audit-missed-webhooks-via-app-delivery-log.md) — App JWT; integer id; prod-owned only.
- [Comments under nv-slang-bot[bot] may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md) — check your action log.
- [slang gates all build/test CI behind non-draft](../learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md) — `ci.yml:15`; slang-rhi opposite.
- [Workflow-YAML rename push is server-rejected](../learnings/1781311192487-workflow-yaml-rename-push-is-server-rejected-issue.md) — post a ready-to-apply diff.
- [CONSOLIDATED GitHub posting policy](../learnings/1781405000000-CONSOLIDATED-github-posting-policy.md) — post by default; verified-at-HEAD guard.
- [wait-for-human-priority gate is self-healing](../learnings/1781553870596-slang-ci-wait-for-human-priority-gate-is-self-heal.md) — don't manually rerun.
- [Verify the actor before reporting a ready-flip violation](../learnings/1782244055186-before-reporting-a-bot-flipped-pr-ready-gate-viola.md) — #11705 maintainer flip.
- [Close as duplicate via GraphQL closeIssue, not REST](../learnings/1782264656205-closing-issues-as-duplicate-use-graphql-closeissue.md) — REST `state_reason` 403s.
- [REFINEMENT: comment PATCH is per-token; CREATE is reliable](../learnings/1782339596766-refinement-bot-issue-comment-patch-is-per-token-no.md) — #11718; supersede with CREATE.
- [Login is bare nv-slang-bot: edit-in-place check must match loosely](../learnings/1782345448967-nv-slang-bot-issue-comment-login-is-nv-slang-bot-n.md) — #10988; verify returned id.
- [Login is nv-slang-bot (User): fix the edit-if-self matcher](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md) — #11759; match both forms.
- [REST label-add can 403; GraphQL succeeds](../learnings/1782476439849-slang-github-rest-label-add-can-403-admin-rights-w.md) — `addLabelsToLabelable`.
- [Lone red workflow_dispatch with build/test skipped is a no-op](../learnings/1782548309438-bot-pr-lone-red-workflow-dispatch-run-with-build-t.md) — judge from the rollup.
- [Auto-route parallel fork; cross-identity DELETE 403s](../learnings/1782391004650-auto-route-can-spawn-a-parallel-triage-fix-fork-du.md) — #11751 three comments.
- [Failing CI checks on bot PRs don't webhook the fixer](../learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md) — babysitter is the signal.
- [Attribute PR ownership by author, not title/branch](../learnings/1782921955519-attribute-pr-ownership-by-author-field-not-title-b.md) — #11850 `[codex]` was human.
- [Gated set is only gh pr ready + merge](../learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md) — #11898 re-confirmed.
- [gh auth status "token invalid" is a false alarm](../learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md) — writes still work.
- [Auth probes misleadingly 401; writes work](../learnings/1783729942892-nv-slang-bot-gh-auth-probes-auth-status-api-user-a.md) — attempt the write.
- [Non-ASCII header CI guard shippable via formatting.sh](../learnings/1783665750293-slang-non-ascii-header-ci-guard-is-bot-shippable-v.md) — no `.yml` edit needed.
- [Held-no-PR is triage's footprint](../learnings/1783708077598-held-no-pr-is-triage-s-github-footprint-fixer-post.md) — #12051 race; fixer pings triager.
- [Bot often can't edit/delete its own comments: prevent](../learnings/1783708188779-correction-nv-slang-bot-often-cannot-edit-delete-i.md) — duplicates may be permanent.
- [Filing an upstream issue triggers duplicate triage](../learnings/1783886221663-slang-escalation-session-that-files-an-upstream-is.md) — detect sibling; re-verify only.
- [Edit bot comments via GraphQL updateIssueComment](../learnings/1784096631139-edit-nv-slang-bot-comments-via-graphql-updateissue.md) — worked where REST 403'd.
- [pr_closed/pr_synchronize webhooks are claims](../learnings/1784114457146-github-pr-closed-pr-synchronize-webhooks-are-claim.md) — #12117 phantom merge.
- [Bot PR reds already BLOCK'd by approver are owned](../learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md) — don't re-surface each sweep.
- [Mermaid flowcharts in comments: lint + render gotchas](../learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md) — no mmdc; avoid `-.-x`.
- [Comment edits don't notify](../learnings/1789477835098-github-comment-edits-don-t-notify-human-questions-.md) — POST fresh when it must be seen.
- [Reply auth: mention-response pre-authorized vs gated](../learnings/1789490708871-github-reply-auth-pre-authorized-mention-response-.md) — what still needs sign-off.
- [Escalation @mentions must be a fresh POST](../learnings/1792550010100-escalation-mentions-must-be-a-fresh-post-even-when.md) — slangpy#163; silent milestone = interest.
- [Bot status changes arrive as in-place edits](../learnings/1793003521449-bot-status-changes-can-arrive-as-in-place-comment-.md) — #13909; check `lastEditedAt`.
- [Post a fresh delta when a human commented since](../learnings/1793395604259-issue-comment-routing-post-a-fresh-delta-when-a-hu.md) — #14103; report the deviation.
- [Rider: PATCH the stale status comment after a fresh POST](../learnings/1793026171832-who-approved-an-action-required-fork-ci-run-trigge.md) — pointer + corrected facts.
- [Milestones are public, not Project-board fields](../learnings/1793286449078-issue-milestones-are-public-not-confidential-proje.md) — `--jq .body > file` adds `\n`.
