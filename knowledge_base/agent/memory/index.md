---
okf_version: "0.1"
---

# Memory Index

## Core Memory

- **Memory lives in this OKF store.** The old native store (`~/.claude/projects/-workspace-agent/memory/`) was migrated into [imported/](imported/index.md) on 2026-08-30 and retired; the router is [imported/MEMORY.md](imported/MEMORY.md).
- **Never record counts in pointers** — they go stale with the next leaf. Live figures: `bash imported/reindex.sh --check`.
- **Dashboard session `sess-1776713576150-9fon2n`: read it only as `ncl sessions messages <sid> --reverse --json --limit ≤400`** (or `--since-seq`). Never a large `--offset` (pre-09-27 that wedged every later `ncl` call); `conversations/*.md` lacks its rows.
- **[legoop-archive/](legoop-archive/index.md) and imported/ are disjoint stores** — never `cp` between them.
- **Before forwarding ANY `pr_ready_for_review` webhook to a `*-pr-approver`, run `ncl groups list` and check `paused` — on the first event, not the repeat.** Both approvers are operator-paused. Disposition a paused-approver failureNotice, then end the turn cleanly with NO reply (an incomplete turn re-queues; reply mints a failed turn). Detail: [pr-approvers-paused.md](pr-approvers-paused.md).
- **`/supervise-issues` tick: read [orchestrator/supervise-tick-runbook.md](orchestrator/supervise-tick-runbook.md) BEFORE the first command.** Never launch the stock `pull-universe.sh` (≈2.4 h); use the latest `tickNNN/pull.sh`.
- **okf-synthesis since 2026-10-15 (repo skill, #2039) misreads nested `metadata.type` frontmatter: its ~1,200 NO-FRONTMATTER/DOSSIER offenders are false — do NOT "fold" them.** Per-run policy: cross-check with `tools/okf_synth.py.before-2039` and fold only what it lists. Detail: [imported/reference_okf_synthesis_provisioning.md](imported/reference_okf_synthesis_provisioning.md).
- **`ncl tasks get/list` from Main only sees MY group; `--agent-group-id` is inert.** "Task not found" for a peer's task is not evidence it is missing — audit via `ncl sessions get <id>` or `ncl sessions list --thread-id system:tasks:<series>` (a `[]` there doesn't prove absence either). Detail: [imported/feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group.md](imported/feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group.md).
- **Message delivery mechanics:** unwrapped plain final text is NOT delivered to a2a agent senders; inside a final response with any `<message>` block, plain text is not delivered either — give each peer instruction its own block. The Slang Maintainer has NO destination name — reply via `send_message({in_reply_to: <its msg id>})`. Detail: [system/hazards.md](system/hazards.md).
- **Pinned/routed peer sends:** a cross-chain `send_message` needs `target_session_id` + `thread_id` + an explicit `in_reply_to` that cannot resolve to the target group. Without it the implicit/auto-stamped reply route wins and the message lands back in this turn's sender (#14006, #14204; 5 recurrences). Verify delivery: target's `ncl sessions messages --reverse --limit 3`. Detail: [imported/feedback_in_reply_to_beats_target_session_id_pin.md](imported/feedback_in_reply_to_beats_target_session_id_pin.md).
- **R6 (#13596): no waiting period — deliver issues at once; only an explicit stand-down stops the bot.** Anything that reaches me past the label gate is fair game. Before dispatching any `issue_opened`: `grep -rl '<num>' memory/slang/`; if a filing batch went Terminal within ~1h, read the batch chain page FIRST (self-echo window). An assignee, self-assignment, milestone, MEMBER/COLLABORATOR author, plan in body, or "tracking" title is NOT a stand-down. Detail: [imported/project_13591_ai_contributor_standards_batch.md](imported/project_13591_ai_contributor_standards_batch.md).
- **A bot-authored issue body that already carries verification results (master sha, repro status, root cause) is our own chain's Terminal filing — do NOT dispatch a triage chain on its `issue_opened`**, even when the number-grep and session list are clean (the grep races the webhook). Disposition: filed-only + report to the operator ([filing policy](orchestrator/filing-verified-issues-policy.md)). Detail: [slang/14548-require-variables-unenforced.md](slang/14548-require-variables-unenforced.md).
- **Never deny "Orchestrator said X" from my own transcript alone.** Sibling Main sessions dispatch in parallel — first search the active Main sessions for the quoted text. Detail: [imported/feedback_check_all_main_sessions_before_denying_orchestrator_said_x.md](imported/feedback_check_all_main_sessions_before_denying_orchestrator_said_x.md).
- **Filing a reproduced, deduped shader-slang bug needs no operator go-ahead; don't ask "should I file it?".** External-repo filings, scope/feature asks and new fixer chains still go to the operator. Detail: [orchestrator/filing-verified-issues-policy.md](orchestrator/filing-verified-issues-policy.md).
- **No per-PR "may #N leave draft?" asks to the operator.** Record it as ready-flip pending; the operator gets one weekly list. Exception: P0/P1 or regression fix. Detail: [orchestrator/undraft-asks-replaced-by-weekly-list.md](orchestrator/undraft-asks-replaced-by-weekly-list.md).
- **Before any infra alert (disk, runners, CI queue, auth), grep the dashboard's last ~15 rows for the topic; post only new facts.** Detail: [orchestrator/infra-alert-dedupe-across-sessions.md](orchestrator/infra-alert-dedupe-across-sessions.md).
- **A `pr_mention` webhook body has the leading `@nv-slang-bot:` stripped.** Read the GitHub comment body before relaying "no mention" or leaving out `<github-post-authorized />` (#14259). Detail: [feedback_pr_mention_body_strips_leading_mention.md](feedback_pr_mention_body_strips_leading_mention.md).
- **HARD RULE (tangent-vector, PR #14627): never write "as in C++" (or any C++/HLSL-comparison phrasing) in shader-slang/slang artifacts** — comments, PR descriptions, commits, issue comments — without strong justification stated in place; fixer review passes grep the diff before push. Applies to every dispatch brief and artifact review Main writes. Detail: learning `1795125243173-hard-rule-never-write-as-in-c-or-c-comparison-phra`.
- **The skills registry (`/app/skills` ≡ `.agents/skills`) is read-only from every container.** Skill fixes go to the operator as a copy-patch-test-verify-then-hand-over diff; an `append_learning` cannot change skill behavior (R10 author defect ran 3 weeks despite 2 learnings). Detail: [system/skills-registry-readonly.md](system/skills-registry-readonly.md).
- Full context, evidence and history for these: [system/hazards.md](system/hazards.md).

## Map

- [Memory system definition](system/definition.md) - how this memory works, and yours to improve
  ([folder index](system/index.md))
- [Slang / slang-rhi chain records](slang/index.md) - per-chain state for shader-slang issue/PR work
  (written here because it's this session's own chain detail; operational routing rules still live in
  the live store above)
- [Ported lego-operator archive](legoop-archive/index.md) - **52 `legoop-*.md` operator facts that
  exist ONLY in this store**, now in their own folder with a proper folder index and `type:`
  frontmatter on each. ⭐ **A backtick is not a link — a filename in prose is invisible to every
  reachability check**; link the folder, not the filenames in prose.
- [#11135 IRTypeAlignmentAttr chain](project_11135_ir_type_alignment_attr_12306.md) - maintainer-requested
  impl; peer review found a triple-verified 🔴 `addAttrs` interleaving bug. **Reachable from no index in
  either store and absent from the live one** — relinked here 2026-08-05.
- [#12307 reflection-json scope representation](project_12307_reflection_json_scope_representation.md) -
  MERGED 2026-08-15/19 (PR #12310). Terminal record + durable CI/reachability lessons.
- [slang-vscode-extension #76 MEMFS sync](project_vscode_extension_76_memfs_sync.md) - triage-only
  disposition for the out-of-fleet `shader-slang/slang-vscode-extension` repo (no coworker owns it;
  I triage its webhooks directly). #76 depends on #75; left to human assignee.
- [Orchestrator operational reference](orchestrator/index.md) - on-demand Main
  reference (mounts incl. `/workspace/project`, create_agent vs SDK Agent,
  interactive prompts, self-modification). Distilled 2026-08-18 from the legacy
  always-injected `CLAUDE.local.md`; the composed spine (`CLAUDE.md`) stays
  canonical for role/tools/routing/Projects.
- [Harness / provider findings](harness/index.md) - durable structural facts about
  running a group on the Codex provider vs Claude (headline: settings.json hooks are
  inert for Codex). Distilled 2026-08-20 from the May-2026 A/B and parity R&D notes.
- [PR approvers paused](pr-approvers-paused.md) - **check `paused` before routing any
  approver webhook**; both approvers are operator-paused and the decision is still pending.
  Per-PR bounce dispositions (grep before re-investigating any approver bounce):
  [pr-approvers-paused-bounce-log.md](pr-approvers-paused-bounce-log.md).
- [No gratuitous cross-repo links](feedback_no_gratuitous_cross_repo_links.md) - bot GitHub posts cite
  other repos' issues/PRs as plain text; links notify outsiders (operator 2026-10-22).
- [Fixers cannot request reviewers](feedback_fixers_cannot_request_reviewers.md) - never ask a fixer to
  (re-)request review **or mark a draft ready** (`gh pr ready`); their spine forbids both and Main can't override. Use a PR comment or a human click.
- [The triager cannot close issues](feedback_triager_cannot_close_issues.md) - its write guardrail treats closing a GitHub
  issue as maintainer-only; dispatch resolution comments instead and leave the close as a human action item. Closing our own
  draft PRs (supersede pointer) is in-surface (verified 11-18).
- [Update reviewed PRs by merge, not rebase](feedback_update_reviewed_pr_by_merge_not_rebase.md) - dispatch "merge master" for a
  human-reviewed PR; never ask for a rebase + force-push (maintainer direction, #12194).
- [Supervise-tick delivery guardrail](project_supervise_tick_no_cc_discord.md) - each
  `/supervise-issues` tick delivers to `orchestrator-dashboard` and nowhere else; never
  CC a coworker.

### Superseded / pruned working notes

- Pruned once distilled (retiring a distilled note is a success): the May-2026 provider R&D
  root files now live as findings in [harness/](harness/index.md); the dated June/July board and
  cron snapshots are audit stubs in [Superseded supervisor snapshots](superseded-supervisor-snapshots.md)
  and [Tracker tick 66](tracker-tick.md) (live successor: `supervisor-state.json`). Not for reading.

- [Imported native memory](imported/index.md) — the native store migrated 2026-08-30; router at
  [imported/MEMORY.md](imported/MEMORY.md). `reindex.sh` regenerates the family shards and removes their
  source monoliths. Leaves are distilled incrementally by the OKF-synth cron. Live figures:
  `python3 /workspace/agent/tools/okf_synth.py scan` and `bash imported/reindex.sh --check`.
