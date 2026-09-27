---
name: slang-routing-lessons-index
description: "Standing lessons on routing, posting authority, GitHub write gates, a2a edges, infra/perms, and tooling. Split out of MEMORY.md to keep the root index under the Read limit. Consult before any dispatch, GitHub write, or coworker-wiring decision."
metadata: 
  node_type: memory
  type: index
  title: Routing / posting / authority standing lessons
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# Routing, posting, authority — standing lessons

One line per entry; open the linked file before acting. Detail lives in the leaves, not here.

## Rules that were once dark (re-homed 2026-08-04 — do not delete without re-homing)

Found by a transitive reachability sweep:
[[feedback_reachability_metric_must_be_transitive_and_class_segmented]].

- [Supervisor nudge must never instruct `gh issue close`](feedback_supervisor_nudge_no_auto_close.md)
- [A coworker breaking a just-agreed gate may be respawn amnesia](feedback_coworker_respawn_drops_verbal_gates.md)
- [Main cannot approve its own `install_packages` / `add_mcp_server`](feedback_main_cannot_approve_install_packages.md) — routes to a human admin.
- [Prove a session exists with `ncl sessions list --thread-id`](feedback_thread_id_filter_for_session_existence.md)
- [A legitimate operator DM appears as `sender=Unknown`](feedback_operator_dm_unknown_attribution.md)
- [Supervisor nudges quote the issue's real comment verbatim](feedback_nudge_relay_verbatim_source.md)
- [`supervise-issues` scan.py false-flags prod-instance `dev/*-fixer/*` PRs](feedback_supervisor_scan_misses_prod_branch_prs.md)

## Authority and GitHub writes

- [Never route operator gates through coworkers; maintainer approval ≠ merge authority](feedback_dont_route_operator_gates_through_coworkers.md) · [`gh` ready + merge are operator-gated](feedback_github_writes_operator_authorized.md) · [Drafts only](feedback_drafts_only_guardrail.md) · [Pushes are not gated writes](feedback_pushes_not_gated.md) · [Supervisor authority](feedback_supervisor_autonomous_authority.md) · [Push-not-sent ≠ away](feedback_push_not_away.md)
- ⭐[gh auth probes mislead — OneCLI injection is per-path](feedback_gh_auth_status_misleading.md): never `rate_limit`, never `.permissions` alone; read the body, since a 401, an error page and a 200 all look like "no data" through a header grep.
- [Post verified, hold otherwise](feedback_triage_github_posting.md) · [Authorize comment matches memo hedging](feedback_authorize_comment_matches_memo_hedging.md) · [Edit comments in place](feedback_github_comment_hygiene.md) · [Re-derive approver file:line before routing public](feedback_verify_approver_facts_before_routing_public.md) · [Bot-review line numbers are diff-relative](feedback_diff_relative_line_numbers_in_bot_reviews.md) · [Tell the footprint owner when you post yourself](feedback_tell_the_footprint_owner_when_you_post_yourself.md) · [Don't post and delegate the same write](feedback_dont_post_and_delegate_same_write.md)
- [Approver never posts — route the reviewer](feedback_approver_never_posts_route_reviewer.md) · [Debounce PR review on churn](feedback_debounce_pr_review_on_churn.md) · ⭐[Debounce approver ABSTAIN](feedback_debounce_approver_dispatch_deterministic_abstain.md) — the duplicate-vs-advance check is the dispatcher's: a webhook payload carries no head sha, so compare `pulls/{n}.head.sha` and state the sha; filter a diff by extension, not top-level dir.
- ⭐[Two tiers running one frame is shared prior, not independent evidence](feedback_two_tiers_one_frame_is_shared_prior.md) — date the change, not the file; errors all pointing one way are bias.
- [Route webhooks by `content.event`](feedback_webhook_dispatch_by_event.md) · [Routing-gate markers and resend](feedback_routing_gate_marker_and_resend.md)
- ⭐[Attribution is not delegation](feedback_attribution_is_not_delegation.md) — an action a peer assigns you is not one you hold; accept-and-record or decline back.

## Reading GitHub state correctly

- ⭐GitHub reads are endpoint-split: [inbound scan needs `issues/{n}/comments`](feedback_inbound_scan_must_cover_issue_comments_not_just_reviews.md) · [harvest needs `pulls/{n}/comments`](project_approver_endpoint_split_harvest_audit.md) — signal-field defect only; name the artifact that would show harm and open it before claiming victims.
- [CHANGES_REQUESTED ≠ edit list — read the body](feedback_changes_requested_read_body.md) · [Empty-body review ≠ inbound](feedback_empty_body_review_not_an_inbound.md) · [Don't close open proposals](feedback_dont_close_open_proposals.md) · [Contributor PR offers → yes](feedback_contributor_pr_offer_brief.md)
- ⭐[Re-open ≠ release a parked feature; read polarity before existence](feedback_reopen_not_release_parked_feature.md) · ⛔[`state_reason` and close metadata are not polarity either](feedback_state_reason_is_not_polarity_either.md) — polarity is in the comment body; quote the sentence.

## Messaging mechanics and a2a edges

- ⭐[Narrating a non-reply is a reply](feedback_narrating_a_non_reply_is_a_reply.md) — only the receiving tier can see the loop; cure is `<internal>` or empty output.
- [Admin standing rules precede orchestrator](feedback_admin_standing_rules_precedence.md) · ["Holding" echoes are noise](feedback_holding_echoes_are_noise.md) · [Bare text is delivered → `<internal>`](feedback_bare_text_is_delivered.md) · [`<message>` before a tool call is dropped](feedback_message_block_before_toolcall_dropped.md) · [No `add_reaction` to coworkers](feedback_no_reaction_acks_to_coworkers.md) · [Reports carry inline links](feedback_report_links.md) · [Status table](feedback_status_format.md) · [Supervisor table tier links](feedback_supervisor_table_tier_links.md) · [NG deferred asks](feedback_ng_deferred_asks.md)
- ⛔[Main → `orchestrator` is a self-loop; "up" is the `orchestrator-dashboard` channel](feedback_main_to_orchestrator_is_a_self_loop_use_dashboard.md) — a redrive naming my own group id means I sent to myself; find why before re-sending.
- [a2a edge vanish → silent hang](project_coworker_named_edge_dropped_silent_hang.md) · [In-session Monitors die on teardown](feedback_in_session_monitors_dont_survive_teardown.md) · [No double dispatch to peer-wired pairs](feedback_no_double_dispatch_peer_wired.md) · [Route authorizations through the dispatch owner](feedback_route_authorizations_through_dispatch_owner.md) · [Fixer owns its single session](feedback_let_fixer_own_single_session.md) · [No restart on a benign ack loop](feedback_benign_ack_loop_dont_restart_if_live_chains.md)
- ⭐[Empty `ncl tasks list` is a real bug (nanoclaw#1064), not a freeze](feedback_watchdog_ncl_tasks_list_empty_not_a_freeze.md) — control is `ncl tasks list --session <id>`; `ncl sessions list` caps at 200.
- Unlinked routing notes: check assignee before re-wake · RED re-triage → 1 owner · `ncl tasks` cron · verify `report_pr_created` · nanoclaw fork no-route · auto-route pressures parks.
- Unlinked fork/dup-PR notes: docs-site push 401 → REST · fork PR → carrier · dup PRs dev↔prod (`fix/issue-*` = dev, `dev/*` = prod) · fork-reentrancy phantom co-driver · bot comments are echoes · stacked-PR base clobber.

## Gates, infra, permissions

- ⭐[Critique gate `/pulls` is a hardcoded built-in floor](project_critique_gate_pulls_pattern_builtin_floor.md) — denials come from session state; identify the denier before blaming a matcher; approve no bypass cards, and never dismiss a queue on a report that explains only its newest row; approval→session mapping is Main's (`ncl approvals get`).
- Infra/perms: [Fleet disk — don't prune worktrees blindly](project_fleet_disk_capacity_wall_11969.md) · [Reap merged-PR worktrees](feedback_always_reap_merged_worktrees.md) · [Bot can't push workflow YAML](project_bot_workflows_permission.md) · [Bot lacks Discussions:write](project_bot_discussions_write_permission_gap.md) · [Bot-PR cosmetic red](project_bot_pr_priority_yield_red_run.md) · [nv-coworkers auto-merge](feedback_nv_coworkers_automerge.md)
- Auth outages need an operator re-login: [slang-fixer](project_slang_fixer_auth_outage.md) · [GitHub gateway 401](project_github_actions_graphql_401_outage.md) · [Discord gateway 401](project_discord_gateway_401_outage.md)

## Tooling and retrieval

- ⭐[Retrieval gap — grep shared-learnings bodies before deriving a mechanism](feedback_retrieval_gap_grep_shared_learnings_before_deriving.md) — never generated `INDEX.md`; check each hit for SUPERSEDED.
- [Duplicate-H1 is a generator defect](project_shared_learnings_duplicate_h1_generator_defect.md) — fix host-side, don't mass-edit · [H1-rate postmortem (fence-aware scan)](project_shared_learnings_h1_rate_postmortem.md) · [scan.py over-flags bot logins](feedback_scan_py_overflags_bot_logins_dispositions.md) · [sub-thread key parse FP](project_scan_py_subthread_key_parse_falsepositive.md) · [Wiki finalize recount recipe stale](project_learnings_wiki_finalize_recount_recipe_stale.md)
- Reference: [Coworker → repo routing](reference_coworker_repo_routing.md) · [Maintainer handles](reference_slang_maintainer_handles.md) (jkwak = `jkwak-work`) · [User interests](user_interests.md)
- Unlinked incidents: self-wiring loop · taskless-fixer review-CC loop · stall sweep · scheduler stall · upstream sync · nv-bot MQ.
