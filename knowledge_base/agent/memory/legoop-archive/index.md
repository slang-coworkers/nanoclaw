---
type: index
title: Ported lego-operator-memory archive
description: 52 legoop-* operator facts (feedback/project/reference) ported from the lego dev instance; exist ONLY in this store
---

# Ported lego-operator archive

These 52 `legoop-*.md` files are operator facts **ported from the lego dev
instance** — they exist ONLY in this store (all absent from the live
`/home/node/.claude/.../memory` index). A distinct namespace, not a copy of
anything: never `cp` between the two stores. Each carries `type:` frontmatter
(feedback / project / reference) matching its name prefix.

## Map

- [All PRs/commits to slang-coworkers/* must be nv-slang-bot[bot] — never a personal account](legoop-feedback_always_nv_slang_bot.md) — ported from lego operator memory
- [Never hand-edit (tighten/reword) container files that originate from upstream — they conflict on every /update-nanoclaw sync. Check against origin/main + upstream/main + nanocoai/main before editing.](legoop-feedback_dont_tighten_upstream_files.md) — ported from lego operator memory
- [Never put inline `# comments` after KEY=VALUE in `.env` files. systemd's EnvironmentFile passes the whole line literally, comment included, and any program that types-check the value will silently fail.](legoop-feedback_env_no_inline_comments.md) — ported from lego operator memory
- [gh auth status / OneCLI connections page are misleading — try the real op](legoop-feedback_gh_auth_status_misleading.md) — ported from lego operator memory
- [Files under container/overlays/ are applied across all projects. Never hardcode project-specific paths (e.g., corvk/, holohub/); use <project>/ placeholders or generic prose.](legoop-feedback_overlays_project_generic.md) — ported from lego operator memory
- [On a GitHub PR thread, post ONE comment per inbound webhook task and edit it for follow-ups. Only create a new comment when a new webhook arrives.](legoop-feedback_pr_comment_edit_not_spam.md) — ported from lego operator memory
- [Backticked `/name` in source workflows is parsed by the composer as a NanoClaw slash ref. For GitHub PR-comment bot commands (/regenerate-toc, /format), write as plain quoted string with explicit "(GitHub bot command)" note.](legoop-feedback_slash_refs_gh_bot_vs_skill.md) — ported from lego operator memory
- [issue_comment backfill must use gh-issue-<repo>-<num> thread or it orphans; the rejoin fix is](legoop-project_backfill_thread_rejoin.md) — ported from lego operator memory
- [chain-routing check (ALWAYS-ON, not an overlay) enforces in_reply_to on marked handoffs; June 2026](legoop-project_chain_routing_gate.md) — ported from lego operator memory
- [Pending — `ask_user_question` cards reach pending_questions + delivery layer but don't render in the dashboard thread view; investigate later](legoop-project_chat_sdk_card_not_rendered.md) — ported from lego operator memory
- [ci.yml composed-merge step fleet-fix — old abort-on-conflict dropped nv-main (sidebar_group schema fail); --ours leaves pkg/lock mismatch on leaf bases; fix = resolve owned conflicts to origin/nv-main](legoop-project_ci_canonical_resolution_595.md) — ported from lego operator memory
- [PR](legoop-project_ci_hardening_534.md) — ported from lego operator memory
- [Only origin/nv-main has the modern ci.yml that triggers on nv-* PRs and does the fan-merge; sibling nv-* branches still ship the old \"branches:[main]\" trigger so PRs to them get NO CI until that update propagates.](legoop-project_ci_yml_propagation.md) — ported from lego operator memory
- [Codex CLI ignores settings.json hooks → disable_overlays=1 for codex agents](legoop-project_codex_no_overlays.md) — ported from lego operator memory
- [Every `[composer] Unknown slash ref` warning is a prompt-quality bug; R18 in claude-composer-refactor.test.ts gates the invariant on nv-coworkers integration.](legoop-project_composer_zero_warnings.md) — ported from lego operator memory
- [How an agent container resolves a chain's PR/issue link — thread_id is unreliable, pr_session_mappings is unreadable, use gh](legoop-project_container_pr_lookup.md) — ported from lego operator memory
- [The](legoop-project_dashboard_hidechatter_scope.md) — ported from lego operator memory
- [Dashboard per-coworker Sessions list must source from sessions table, not the capped hook_events scan](legoop-project_dashboard_session_list_source.md) — ported from lego operator memory
- [The nv-* fan-merge into nv-coworkers is done LOCALLY on each instance by /update-nanoclaw-instance — NEVER pushed to origin/nv-coworkers. Pushing it produces a huge misleading diff and is wrong.](legoop-project_fanmerge_is_local_only.md) — ported from lego operator memory
- [Renaming an agent group — the full checklist (miss one → routing breaks)](legoop-project_group_rename.md) — ported from lego operator memory
- [Non-admin coworkers do NOT get host-side MCP tools (slang-mcp, deepwiki) from their coworker type. Must be explicitly set via allowed_mcp_tools column.](legoop-project_host_mcp_tools.md) — ported from lego operator memory
- [How szihs installation tokens are generated and refreshed in the dev vault](legoop-project_installation_tokens.md) — ported from lego operator memory
- [Why prod→lego forwarded issue OPENS but not issue COMMENTS — the mention gate runs before deliverGitHubMention's ROUTE_ISSUES_TO branch. Fixed in PR](legoop-project_issue_comment_mention_gate.md) — ported from lego operator memory
- [Discord: prod is the live poster; dev/lego is read-only — prod NEVER gets DISCORD_READ_ONLY](legoop-project_lego_discord_readonly.md) — ported from lego operator memory
- [lego dev `groups/<name>/` dirs are symlinks to /ephemeral/lego-groups/<name>/ — except main/ and templates/ which carry git-tracked files](legoop-project_lego_groups_on_ephemeral.md) — ported from lego operator memory
- [Repo-level webhook id 626464745 (slang-coworkers/nanoclaw → lego) was deleted 2026-05-28. Delivery now goes through prod via INSTANCE_FORWARD_TARGETS.](legoop-project_lego_repo_webhook.md) — ported from lego operator memory
- [CI fan-merge aborts when an overlay branch edits nv-main-owned base files (the sidebar_group case, PR](legoop-project_nv_dashboard_base_file_conflict.md) — ported from lego operator memory
- [OneCLI match-priority quirks (host + path pattern)](legoop-project_onecli_match_priority.md) — ported from lego operator memory
- [Deterministic GitHub identity routing in lego dev OneCLI vault (:10254 (NOTE: dev vault was :10256; prod is :10254)) — three identities, three tiers, single catch-all](legoop-project_onecli_routing_model_dev.md) — ported from lego operator memory
- [Snapshot of OneCLI dev vault (10256) — every secret either auto-refreshed or has a documented manual-rotation reason. Closes the orphaned-secret class of bugs (e.g. a043b2b3 stayed empty for weeks).](legoop-project_onecli_vault_audit_2026_06_01.md) — ported from lego operator memory
- [Overlay insert-before/insert-after targets require {#anchor-id} on workflow step headings. Without it, composer warns "none of its anchors match steps" and gate markers don't render.](legoop-project_overlay_anchors.md) — ported from lego operator memory
- [legoop-project_overlay_hooks.md](legoop-project_overlay_hooks.md) — ported from lego operator memory
- [Webhook events for PRs route to the session that created them via pr_session_mappings table. Agents call report_pr_created() to register.](legoop-project_pr_session_mapping.md) — ported from lego operator memory
- [Prod is the canonical GitHub webhook router; it forwards lego-owned events over localhost](legoop-project_prod_canonical_webhook_router.md) — ported from lego operator memory
- [Prod groups live on the real OS disk (not /ephemeral) — watch disk pressure](legoop-project_prod_groups_real_disk.md) — ported from lego operator memory
- [prod forwards issue OPENS to lego but processes issue COMMENTS itself — not duplicate work](legoop-project_prod_lego_routing_split.md) — ported from lego operator memory
- [legoop-project_prod_vault_migration.md](legoop-project_prod_vault_migration.md) — ported from lego operator memory
- [legoop-project_session_may11.md](legoop-project_session_may11.md) — ported from lego operator memory
- [2026-05-18 session — Discord workflow modernization + ccusage 19 schema break + recompose-on-boot + lego eager Gateway. Both lego and prod updated. Major chain: PRs #347/#351/#352/#356/#359/#360/#361/#362/#363/#364/#365.](legoop-project_session_may18.md) — ported from lego operator memory
- [Root cause of issue](legoop-project_session_reuse_misattribution.md) — ported from lego operator memory
- [legoop-project_session_state_may9.md](legoop-project_session_state_may9.md) — ported from lego operator memory
- [Skills migrating from nv-slang/nv-slangpy to shader-slang/slang-skills repo via gh skill install at build time](legoop-project_skill_registry.md) — ported from lego operator memory
- [project-common spines must leave `workflows: []`; leaves list only project-scoped workflows. Listing a base workflow name there duplicates content because project workflows already `extends:` the base body.](legoop-project_spine_sibling_parity.md) — ported from lego operator memory
- [How NanoClaw's MCP server supervision works after PRs](legoop-project_supergateway_leak_architecture.md) — ported from lego operator memory
- [szihs PAT path-routed in dev:10254 (NOTE: dev vault was :10256; prod is :10254) for github.com/szihs/* push — orchestrator-only, restored 2026-05-28 after the bot-token-overwrite regression](legoop-project_szihs_pat_path_routing.md) — ported from lego operator memory
- [nv-dashboard / nv-slang / nv-slangpy / nv-nanoclaw carry 11 stale files (renames+deletes from nv-main) — silently re-dropped every /update-nanoclaw-instance run](legoop-project_update_nanoclaw_merge_drift.md) — ported from lego operator memory
- [Minting/using a GitHub App token directly needs a clean env (proxy collision)](legoop-reference_gh_app_token_mint.md) — ported from lego operator memory
- [OneCLI does HTTP-header injection ONLY — not env-var, no secret-reveal](legoop-reference_onecli_injection_modes.md) — ported from lego operator memory
- [Fine-grained PAT \"Webhooks: Read and write\" must be explicitly checked — repo admin role does NOT imply it. 403 \"Resource not accessible by personal access token\" with X-Accepted-Github-Permissions header reveals the missing scope.](legoop-reference_pat_repository_hooks.md) — ported from lego operator memory
- [How to list prod→lego forwarded GitHub issues/comments over a time window (the dev-routed log line)](legoop-reference_prod_lego_forward_query.md) — ported from lego operator memory
- [systemd units on this host — which one is prod](legoop-reference_systemd_units.md) — ported from lego operator memory
- [How to push .github/workflows/ changes to slang-coworkers/nanoclaw despite nv-slang-bot lacking 'workflows' scope — push to the szihs/nanoclaw fork path so OneCLI injects the workflow-scoped szihs PAT; the fork redirects to slang-coworkers.](legoop-reference_workflow_push_via_szihs_fork.md) — ported from lego operator memory
- [Do NOT CC the /supervise-issues tick summary to slang-discord-support — deliver only to orchestrator-dashboard](project_supervise_tick_no_cc_discord.md) — model-driven CC, not asked for anywhere; recurs because tick runs new_session so chat corrections evaporate
