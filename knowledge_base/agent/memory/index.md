---
okf_version: "0.1"
---

# Memory Index

## Core Memory

- **Memory lives in this OKF store.** The old native store (`~/.claude/projects/-workspace-agent/memory/`) was migrated into [imported/](imported/index.md) on 2026-08-30 and retired; the router is [imported/MEMORY.md](imported/MEMORY.md).
- **Never record counts in pointers** — they go stale with the next leaf. Live figures: `bash imported/reindex.sh --check`.
- **Dashboard session `sess-1776713576150-9fon2n`: read it only as `ncl sessions messages <sid> --reverse --json --limit ≤400`** (rows under `.data`); to reach further back, `--since-seq <seq> --limit ≤400` is also bounded (used 2026-10-07 to cover a 4-day gap). The host bounded this read on 2026-09-27 (two-phase keys-then-content, nanoclaw `e24a7ec64`/`9b0003065`); before that it was unbounded and wedged every later `ncl` call. Never page it with a large `--offset`. `conversations/*.md` does **not** contain dashboard-session rows.
- **[legoop-archive/](legoop-archive/index.md) and imported/ are disjoint stores** — never `cp` between them.
- **Before forwarding ANY `pr_ready_for_review` webhook to a `*-pr-approver`, run `ncl groups list` and check `paused` — on the first event, not the repeat.** Both approvers are paused; detail in [pr-approvers-paused.md](pr-approvers-paused.md).
- **`/supervise-issues` tick: read [orchestrator/supervise-tick-runbook.md](orchestrator/supervise-tick-runbook.md) BEFORE the first command.** Never launch the stock `pull-universe.sh` (≈2.4 h on per-session cost-cap calls); use the latest `tickNNN/pull.sh`. Ticks 272–274 each lost 4–35 min by starting from SKILL.md instead.
- **okf-synthesis since 2026-10-15 (repo skill, #2039) misreads nested `metadata.type` frontmatter: its ~1,200 NO-FRONTMATTER/DOSSIER offenders are false — do NOT "fold" them.** Escalated to the owner; detail in [imported/reference_okf_synthesis_provisioning.md](imported/reference_okf_synthesis_provisioning.md).
- **`ncl tasks get/list` from Main only sees MY group; `--agent-group-id` is inert.** "task not found" for a peer's task is not evidence it is missing. To audit one, run `ncl sessions get <its session_id>`, or `ncl sessions list --thread-id system:tasks:<series>`. A `[]` from the second does not prove absence: tasks on legacy shared sessions return `[]` too. On 2026-10-15 (#13637) I falsely told a peer and the dashboard that a re-check was missing. Detail in [imported/feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group.md](imported/feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group.md).
- **If a final response has any `<message>` block, plain text in it is not delivered — give each peer instruction its own block.** Lost a fixer instruction this way on 2026-10-21 (#13789).
- **A cross-chain pinned `send_message` needs `in_reply_to=<my own webhook row>` as well as `target_session_id`.** Otherwise the auto-stamped reply route wins, and the message lands back in the sender's session. This has happened 3 times (10-08, 10-15, 10-29). Afterwards, verify with the target's `ncl sessions messages --reverse --limit 3`. Detail: [imported/feedback_in_reply_to_beats_target_session_id_pin.md](imported/feedback_in_reply_to_beats_target_session_id_pin.md).
- **A cross-session relay — and any NEW delegation to the group that sent this turn's inbound — needs an explicit `in_reply_to` that cannot resolve to the target group (`in_reply_to=2`, my webhook row).** Without one, the implicit in_reply_to beats both `target_session_id` and `thread_id`, and the message goes back to whoever sent this turn's inbound (#14006 10-29; #14204 11-02, 4th recurrence).
- **R6 (#13596) has no waiting period: deliver human-filed issues at once.** nanoclaw #1993 (merged 10-25; "Decision 2026-10-24: no waiting period") drops `GoodFirstBug`/`HelpWanted`/`no-bot` issues at the webhook, and `bot-ok` hands one back. Anything that reaches me is fair game. A person makes the bot stand down by asking explicitly (szihs on #13596, 11-02). From 10-29 to 11-02 I enforced a stale 4-day hold that also blocked PRs, a rule from the #1993 draft. It is retired; don't put it in dispatches. Records dated ≤11-02 that say "PARKED: R6 to …" show the retired rule, so never copy that pattern (on 11-02 I copied it into the #14159 dispatch; it was released 11-05). Detail: [imported/project_13591_ai_contributor_standards_batch.md](imported/project_13591_ai_contributor_standards_batch.md).
- **Before dispatching ANY `issue_opened` (bot-filed especially), run `grep -rl '<num>' memory/slang/` on that number alone, and read every hit.** A bot-filed issue is usually a follow-up that an existing chain already owns ("needs no dispatch"). On 10-29 I grepped two numbers through `head`, missed the #14007 record, and minted a duplicate triager + fixer for #14042. **Also read live `assignees`** (`gh api repos/<o>/<r>/issues/<N>/events`; there `.actor` is the *assignee* — who assigned is `.assigner`, misread on #1258 11-06). The payload has no assignee, and a maintainer self-assigned issue is held under rung 4. #14333 (11-05) was self-assigned 7 s after filing, and I dispatched triage anyway.
- **Never deny "Orchestrator said X" from my own transcript alone.** Sibling Main sessions dispatch in parallel; the babysitter-sweep thread dispatched slangpy-fixer for #1250 while I dispatched the triager. On 10-30 I falsely retracted a choice that a sibling had made. First search the active Main sessions for the quoted text. Detail: [imported/feedback_check_all_main_sessions_before_denying_orchestrator_said_x.md](imported/feedback_check_all_main_sessions_before_denying_orchestrator_said_x.md).
- **Filing a reproduced, deduped shader-slang bug needs no operator go-ahead; don't ask "should I file it?".** External-repo filings, scope/feature asks and new fixer chains still go to the operator. (R6 no longer holds anything back, so naming the issue is fine.) Detail: [orchestrator/filing-verified-issues-policy.md](orchestrator/filing-verified-issues-policy.md).
- **No per-PR "may #N leave draft?" asks to the operator** (answered ~0 of dozens; maintainers flipped all 21 bot merges since 10-20). Record it as ready-flip pending; the operator gets one weekly list. The exception is a P0/P1 or regression fix. Detail: [orchestrator/undraft-asks-replaced-by-weekly-list.md](orchestrator/undraft-asks-replaced-by-weekly-list.md).
- **Before any infra alert (disk, runners, CI queue, auth), grep the dashboard's last ~15 rows for the topic. Post only new facts.** Parallel Main sessions sent 8 disk alerts in 13 min on 11-04. Detail: [orchestrator/infra-alert-dedupe-across-sessions.md](orchestrator/infra-alert-dedupe-across-sessions.md).
- **A `pr_mention` webhook body has the leading `@nv-slang-bot:` stripped.** Read the GitHub comment body before relaying "no mention" or leaving out `<github-post-authorized />` (#14259, 11-09). Detail: [feedback_pr_mention_body_strips_leading_mention.md](feedback_pr_mention_body_strips_leading_mention.md).
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
- [No gratuitous cross-repo links](feedback_no_gratuitous_cross_repo_links.md) - bot GitHub posts cite
  other repos' issues/PRs as plain text; links notify outsiders (operator 2026-10-22).
- [Fixers cannot request reviewers](feedback_fixers_cannot_request_reviewers.md) - never ask a fixer to
  (re-)request review **or mark a draft ready** (`gh pr ready`); their spine forbids both and Main can't override. Use a PR comment or a human click.
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
