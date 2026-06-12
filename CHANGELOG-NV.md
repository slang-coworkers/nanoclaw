# NanoClaw Daily Changelog (nv-* branches)

Auto-generated daily rollup of merged PRs across the five upstream branches that feed `nv-coworkers` via the merge train. For semver release notes, see [CHANGELOG.md](CHANGELOG.md).

For architectural context — spines, workflows, overlays, traits, bindings (the lego coworker composition system most of these PRs touch) — see [docs/lego-coworker-workflows.md](https://github.com/slang-coworkers/nanoclaw/blob/nv-main/docs/lego-coworker-workflows.md).

| Branch | Scope | Total merged |
|---|---|---:|
| `nv-main` | Host process, composer, base spines/workflows, CI | 242 |
| `nv-dashboard` | Pixel Office dashboard (standalone) | 125 |
| `nv-slang` | slang project spine, skills, workflows | 85 |
| `nv-slangpy` | slangpy project spine, skills, workflows | 34 |
| `nv-nanoclaw` | nanoclaw self-hosted project spine, skills, workflows | 25 |

Cap: ≤10 bullets per branch per day; on busy days, related PRs are grouped or remaining ones are summarized as a tail line. Entry shape: `**#NNN** title`. Today's section uses richer bullets with one-line context per PR. Dates in Asia/Kolkata (IST), newest first.

<!-- BEGIN AUTO -->

## 📅 2026-06-12

### nv-main (2 PRs)
- **#637** `fix(build): skip local skills + fix dir tree-sha check in fetch-skills.sh`
- **#639** `chore(container): bump codex 0.124.0 → 0.139.0 + drop dead CODEX_PROFILE passthrough`

### nv-dashboard (2 PRs)
- **#638** `fix(dashboard): deep-link to a message outside the loaded window`
- **#641** `feat(dashboard): Copy + Link buttons in the thread/a2a side panel`

## 📅 2026-06-11

### nv-main (4 PRs)
- **#620** `docs: update USAGE.md to reflect current coworker state`
- **#627** `fix: add fallback model support and reduce MCP timeout noise`
- **#628** `feat(critique): verdict gate for OUTPUT_REVIEW + sandbox enforcement`
- **#629** `fix(webhook): fall back to orchestrator for CI/review events on PRs the bot was pulled into`

### nv-dashboard (2 PRs)
- **#633** `feat(dashboard): copy-message-to-clipboard button (#632)`
- **#635** `feat(dashboard): shareable permalink to a specific message`

### nv-slang (1 PRs)
- **#630** `feat(slang-github-webhook): repo-keyed generic routing + tighten fix-issue workflow`

### nv-slangpy (1 PRs)
- **#631** `feat(slangpy): webhook handling + PR-review-fix + peer-review parity with slang`

## 📅 2026-06-10

### nv-main (1 PRs)
- **#621** `fix(spine): require reading current source before drafting code claims`

### nv-dashboard (2 PRs)
- **#617** `fix(dashboard): guard ccusage refresh re-entrancy + cap concurrency to CPU threads`
- **#608** `fix(dashboard): prevent XSS via md() link-href attribute injection`

### nv-slang (1 PRs)
- **#622** `fix(slang): work from current checkout + read source before review replies`

### nv-slangpy (1 PRs)
- **#623** `fix(slangpy): work from current checkout before editing code`

### nv-nanoclaw (1 PRs)
- **#618** `fix(agent-runner): reclaim disk on transcript rotation (re-land on nv-nanoclaw)`

## 📅 2026-06-09

### nv-main (1 PRs)
- **#613** `fix(github-webhook): mint a per-PR thread for unmapped PR mentions`

### nv-slang (4 PRs)
- **#611** `fix(slang-github-webhook): route PRs by live fix/issue-<n> branch, not stale dev/<folder>/`
- **#612** `feat(slang-github-webhook): route human/fork PR review-fix requests to the fixer`
- **#614** `feat(slang-triage): allow triage to label issues`
- **#615** `feat(slang-fix-issue): encode what-to-fix (CI + review sweep) in PR-review-fix mode`

## 📅 2026-06-08

### nv-main (3 PRs)
- **#601** `feat(funnel): per-issue partition + win-rate + weekly trend`
- **#604** `fix(spine): draft-held PR still requires an issue comment`
- **#607** `fix(github-webhook): forward issue follow-ups on chains we drive (isParticipantIssue)`

### nv-dashboard (2 PRs)
- **#602** `feat(dashboard): visual issue funnel + fix collapsed board columns`
- **#603** `fix(dashboard): report 1M context window for opus-4-8`

### nv-slang (1 PRs)
- **#605** `fix(slang-triage): draft-held PR still needs the issue comment`

### nv-slangpy (1 PRs)
- **#606** `fix(slangpy-triage): draft-held PR still needs the issue comment`

## 📅 2026-06-06

### nv-slang (3 PRs)
- **#597** `fix(slang): generic push-remote in fix-issue + correct bot identity name`
- **#598** `fix(slang): drop redundant [draft] title prefix from fix-issue PR template`
- **#599** `fix(slang): target master, not main, in fix-issue workflow`

### nv-slangpy (1 PRs)
- **#589** `feat(slangpy-spine): bot-disclaimer in slangpy-common context`

## 📅 2026-06-05

### nv-main (5 PRs)
- **#580** `fix(gates): route chain-routing/critique refusals to the sender, not the peer`
- **#581** `fix(supervise-issues): rediscover chain universe live every tick`
- **#585** `refactor(implement): add {#ship} anchor to the Ship step`
- **#593** `fix(ci): canonical-resolution merge step (composed-state schema + lockfile)`
- **#595** `fix(container): don't bypass proxy for discord.com so OneCLI injects the Bot token`

### nv-dashboard (1 PRs)
- **#594** `fix(ci): canonical-resolution merge step (composed-state schema + lockfile)`

### nv-slang (4 PRs)
- **#582** `fix(slang-triage): codify issue-comment posting; drop contradictory "never post"`
- **#584** `fix(slang-github-webhook): replace deprecated PR_CREATED/pr-mappings.json with report_pr_created`
- **#588** `feat(slang-spine): bot-disclaimer in slang-common context`
- **#591** `fix(ci): canonical-resolution merge step (composed-state schema + lockfile)`

### nv-slangpy (4 PRs)
- **#583** `fix(slangpy-triage): codify issue-comment posting; drop contradictory "never post"`
- **#586** `fix(slangpy-implement): ship override — report_pr_created + Fixes #N in PR body`
- **#587** `feat(slangpy-reviewer): add /slangpy-pr-review workflow + review-output invariant`
- **#590** `fix(ci): canonical-resolution merge step (fixes sidebar_group schema failure)`

### nv-nanoclaw (1 PRs)
- **#592** `fix(ci): canonical-resolution merge step (composed-state schema + lockfile)`

## 📅 2026-06-04

### nv-main (6 PRs)
- **#570** `fix(nv-main): own base-nanoclaw skill where base-common references it`
- **#573** `feat(supervise-issues): track no-PR chains — triage comment as artifact + disposition`
- **#574** `feat(supervise-issues): remove weekend draft→ready CI flip (§7)`
- **#575** `fix(supervise-issues): board delivery MUST specify to= (multi-destination supervisor)`
- **#577** `fix(github-webhook): only 👀 comments addressed to the bot; never self-react`
- **#578** `fix(supervise-issues): board destination = literal to="orchestrator", verbatim, one session`

### nv-dashboard (1 PRs)
- **#576** `fix(dashboard): hide all machine action-envelopes from chat (not just cli_request)`

### nv-nanoclaw (1 PRs)
- **#572** `fix(nv-nanoclaw): drop base-nanoclaw (moved to nv-main #570) + harden ci.yml`

## 📅 2026-06-03

### nv-main (9 PRs)
- **#546** `fix(db): land sidebar_group union on nv-main + renumber migration 028 (fixes composed-tree CI)`
- **#542** `feat(supervise-issues): resumable-artifact directive, weekend CI window, superseded-PR postmortem + worktree GC`
- **#547** `docs(supervise-issues): cost-aware cadence + delta reporting + generic examples`
- **#548** `fix(webhook): process PR comments on mapped PRs + re-read GH_TOKEN at call time`
- **#554** `fix(routing-gate): require in_reply_to only, add soft-cap, backfill critique-gate`
- **#558** `refactor(routing): chain-routing check always-on, not an overlay`
- **#562** `feat(funnel): host-side issue funnel report (script + design doc)`
- **#565** `feat(funnel): scope to shader-slang org by default`
- **#566** `feat(webhook): route PR review verdicts, review threads, and CI failures to the owning fixer`

### nv-dashboard (8 PRs)
- **#522** `feat(dashboard): group coworkers in the sidebar by prod / specific user`
- **#549** `fix(dashboard): show all active sessions in coworker list (untruncate low-volume coworkers)`
- **#540** `fix(dashboard): show command + target detail on cli_command approval cards`
- **#550** `fix(dashboard): filter ncl chatter server-side so large replies are not pushed off the message window`
- **#552** `fix(db): remove orphaned 023-sidebar-group migration (collided at v23, crashed prod)`
- **#553** `fix(dashboard): hoist hideChatterSql scope — restores outbound messages dropped by #550`
- **#563** `feat(dashboard): Funnel tab + /api/funnel (serves cached snapshot)`
- **#564** `refactor(dashboard): move Funnel into Admin > Funnel`

### nv-slang (6 PRs)
- **#543** `refactor(slang-workflows): replace PR-watcher/build-watchdog polling with webhook + subagent`
- **#551** `chore(slang): remove orphaned slang-templates/ dir`
- **#555** `feat(slang): opt chain coworkers into chain-routing-gate`
- **#559** `fix(slang): remove type-declared overlays (dashboard-selected instead)`
- **#568** `ci(slang): propagate nv-main hardened ci.yml (is_owned auto-resolve)`
- **#567** `feat(slang): handle review verdicts, review threads, and CI failures in slang-github-webhook`

### nv-slangpy (3 PRs)
- **#545** `refactor(slangpy-implement): blocking Agent subagent for long builds, drop schedule_task watchdog`
- **#556** `feat(slangpy): opt chain coworkers into chain-routing-gate`
- **#560** `fix(slangpy): remove type-declared overlays (dashboard-selected instead)`

### nv-nanoclaw (3 PRs)
- **#544** `refactor(nanoclaw-implement): blocking Agent subagent for long builds, drop schedule_task watchdog`
- **#557** `feat(nanoclaw): opt chain coworkers into chain-routing-gate`
- **#561** `fix(nanoclaw): remove type-declared overlays (dashboard-selected instead)`

## 📅 2026-06-02

### nv-main (4 PRs)
- **#532** `revert(skills): restore upstream-tracking skills tightened in #526`
- **#534** `ci: harden nv-* fan-merge (owned-conflict auto-resolve) + fix webhook-github test mocks`
- **#536** `fix(webhook): issue_comment fall-through rejoins issue chain (not orphan session)`
- **#539** `fix(spine): substantive human comment re-opens a closed/holding chain`

### nv-dashboard (1 PRs)
- **#538** `feat(dashboard): hide ncl polling chatter + fix Load-older pagination`

### nv-slang (1 PRs)
- **#537** `feat(slang-reviewer): add Reviewer C (clarity) — wraps shader-slang/slang#11340 skills`

## 📅 2026-06-01

### nv-main (8 PRs)
- **#519** `fix(spine): per-edge a2a model + GitHub as primary human-observability surface`
- **#520** `feat(skill/supervise-issues): verify the GitHub-comment loop is closed`
- **#521** `feat(webhook): also dev-route issue comments via ROUTE_ISSUES_TO`
- **#523** `fix(container): rename placeholder auth stub + guard against URL-baked stubs`
- **#530** `style(container-runner): prettier-format OneCLI-stub guard line (unblocks CI)`
- **#524** `fix(spine): tighten chain-reporting + github-comment-not-closure + per-issue routing + tabular status`
- **#525** `fix(webhook): forward issue comments past the mention gate when ROUTE_ISSUES_TO is set`
- **#526** `docs(spine): tighten base spine/skills/workflows/overlays (instruction-context diet)`

### nv-slang (1 PRs)
- **#527** `docs(slang): tighten slang spine/skills/workflows (instruction-context diet)`

### nv-slangpy (1 PRs)
- **#528** `docs(slangpy): tighten slangpy spine + workflows (instruction-context diet)`

### nv-nanoclaw (1 PRs)
- **#529** `docs(nanoclaw): tighten nanoclaw spine + skill + workflows (instruction-context diet)`

## 📅 2026-05-31

### nv-main (1 PRs)
- **#517** `fix(spine): forbid all direct dispatches past a child to its descendants`

## 📅 2026-05-29

### nv-main (3 PRs)
- **#510** `feat(webhook): mint per-issue orchestrator session for issues opened`
- **#513** `fix(routing): canonical thread + parent-concept spine + idempotency`
- **#514** `feat(skill): supervise-issues — periodic supervisor for in-flight issue chains`

### nv-dashboard (3 PRs)
- **#509** `fix(dashboard): timeline depth + InstructionsLoaded detail rendering`
- **#512** `fix(dashboard): webhook envelope renderer + responsiveness + clickable session`
- **#515** `feat(dashboard): clickable dispatch links — open recipient session from outbound message`

## 📅 2026-05-28

### nv-main (13 PRs)
- **#507** `feat(transcripts): add --since-hours filter to build-transcripts-archive`
- **#506** `fix(spine): require explicit thread_id on fresh peer dispatch`
- **#504** `docs: add cross-instance webhook routing doc`
- **#503** `docs(spine): add fan-out rule to agents.md`
- **#501** `feat(webhook): ROUTE_ISSUES_TO — dev-route GitHub issues to a peer instance`
- **#500** `fix(webhook): bring back deterministic host-side 👀 reaction`
- **#497** `chore(docs): scrub developer-specific paths/usernames from on-call runbook`
- **#496** `chore(webhook): drop legacy fanout/require-mapping/host-eyes paths`
- **#495** `feat(webhook): orchestrator routing for unmapped events + issues support`
_+4 more: #493, #492, #491, #459_

### nv-dashboard (3 PRs)
- **#498** `chore(dashboard): scrub developer-specific path from V1 import prompt`
- **#435** `Sync nv-dashboard with upstream/main`
- **#505** `fix(dashboard): SSE state dedup + per-client backpressure`

### nv-slang (3 PRs)
- **#494** `feat(slang-github-webhook): add Step 0 — coworker posts 👀 reaction`
- **#502** `feat(slang-reviewer): post merged review back to GitHub when authorized`
- **#436** `Sync nv-slang with upstream/main`

### nv-slangpy (1 PRs)
- **#437** `Sync nv-slangpy with upstream/main`

### nv-nanoclaw (1 PRs)
- **#438** `Sync nv-nanoclaw with upstream/main`

## 📅 2026-05-27

### nv-main (6 PRs)
- **#475** `fix(webhook): authenticate the 👀 reaction with GH_TOKEN`
- **#477** `show-transcript: sort by last activity + search + activity-window filter + split claude/codex`
- **#478** `fetch-skills: retry transient gh skill install failures + surface real stderr`
- **#481** `codex hooks → dashboard parity (5 lifecycle events) + ncl introspection`
- **#482** `codex hooks: also wire pr-auto-map.sh on PostToolUse(Bash)`
- **#486** `fix(mcp-auth-proxy): make tokenPath overridable so tests do not clobber prod`

### nv-dashboard (5 PRs)
- **#476** `fix(dashboard): surface marker-only overlays in coworker editor`
- **#483** `fix(dashboard): show hidden sessions in the Hidden Sessions expander`
- **#484** `fix(dashboard): on-demand ccusage refresh + subprocess cleanup`
- **#488** `fix(dashboard): bound ccusage fan-out — fix Overview $0 + memory bloat`
- **#489** `fix(dashboard): wire cost refresh to Overview tab, not Infra`

### nv-slang (2 PRs)
- **#479** `slang spine: pin skill-source to @main (slang-skills coworkers branch merged upstream)`
- **#485** `feat(slang-fix-issue): add simplify step before commit`

### nv-slangpy (1 PRs)
- **#480** `slangpy spine: pin skill-source to @main (slang-skills coworkers branch merged upstream)`

## 📅 2026-05-26

### nv-main (5 PRs)
- **#460** `feat(skill): /show-transcript renders Claude+Codex sessions to HTML on :8080`
- **#464** `feat(a2a): pin recipient session via target_session_id`
- **#465** `fix(container-runner,hooks,composer): heal hook bloat + per-stage critique enforcement`
- **#467** `fix(hooks,overlays,spine): plan-gate becomes per-overlay opt-in (mirrors critique-gate)`
- **#473** `feat(webhook): post 👀 reaction on receipt to acknowledge @mentions`

### nv-dashboard (4 PRs)
- **#461** `feat(dashboard): render timestamps in operator-configured TZ`
- **#462** `feat(dashboard): include a2a/self-loop sibling threads in summaries`
- **#463** `fix(dashboard): truthful thread view + accurate badge counts`
- **#472** `fix(dashboard): show cross-session a2a within same agent group`

### nv-slang (2 PRs)
- **#466** `fix(slang): plan-first slang-fix-issue + per-type critique stages`
- **#468** `fix(slang): markdown bullets + heredoc PR body + plan-gate / critique-gate opt-in`

### nv-slangpy (1 PRs)
- **#469** `fix(slangpy): markdown bullets + overlay opt-ins (mirror of #468)`

### nv-nanoclaw (1 PRs)
- **#470** `fix(nanoclaw): markdown bullets + overlay opt-ins (mirror of #468/#469)`

## 📅 2026-05-23

### nv-main (14 PRs)
- **#456** `feat(overlay): emit buddy + critique-gate events to dashboard hook stream`
- **#455** `fix(buddy): wait for SDK to flush JSONL before distilling (#68)`
- **#454** `fix(buddy): repair codex --json thread-id extraction (codex 0.124+ shape)`
- **#453** `fix(critique-gate): close text-output bypass — gate enforces on <message to=> blocks too`
- **#452** `fix(agent-runner): chain regex accepts thread_id; buddy-call.sh jq compiles`
- **#451** `fix(overlay): MARKER materialization is operator-driven, not anchor-driven`
- **#447** `feat(container): per-session ~/.codex mount for ALL coworkers, not just codex-provider`
- **#446** `fix(buddy,critique): missing OVERLAY.md + container-restart resilience`
- **#444** `feat(buddy): hook-driven companion via codex exec; replace Agent-fork pattern`
_+5 more: #443, #442, #441, #440, #439_

### nv-dashboard (3 PRs)
- **#448** `fix(dashboard): preserve underscores in folder→container name match`
- **#450** `fix(dashboard): repair matchContainerName rival logic + matching test (PR #448 follow-up)`
- **#457** `feat(dashboard): render critique-gate REFUSED as collapsed yellow card`

### nv-slang (2 PRs)
- **#445** `feat(slang-pilot): activate critique-gate + buddy-monitor on slang-fixer / -triage / -reviewer`
- **#449** `revert(slang-pilot): drop static overlay assignments — use runtime per-group config`

## 📅 2026-05-22

### nv-main (6 PRs)
- **#424** `ci(format): apply prettier to src/github-webhook-server.ts`
- **#422** `fix(a2a): in_reply_to auto-resolve + soft gate audit`
- **#423** `fix(host): scaffold groups/<gid>/memory/ + --pull=never on per-group rebuilds`
- **#425** `prose(nv-main): buddy rewrite + base spine path-tokens + implement worktree isolation`
- **#430** `fix(audit): meta-ack audit — soft enforcement of [MUST] no-meta-ack rule`
- **#432** `fix(host): --pull=never → --pull=false on per-group docker build`

### nv-slang (2 PRs)
- **#426** `prose(nv-slang): workflow hardening across slang-{plan,triage-issue,fix-issue}`
- **#429** `revert(slang-fix-issue): drop gh auth preflight from Step 1`

### nv-slangpy (1 PRs)
- **#427** `prose(nv-slangpy): workflow hardening across slangpy-{plan,triage-issue}`

### nv-nanoclaw (1 PRs)
- **#428** `prose(nv-nanoclaw): nanoclaw-plan path tokens`

## 📅 2026-05-20

### nv-main (9 PRs)
- **#389** `feat(channels): add Telegram channel adapter`
- **#391** `feat(nv-main): lego spine refactor — composer features, base spine split, workflow tightening`
- **#398** `feat(ncl): expose agent_provider field on groups resource`
- **#401** `fix(nv-main): a2a multi-hop ancestor routing + thread-aware reply primitives`
- **#402** `fix(nv-main): tighten a2a reply precedence and ancestor guards`
- **#403** `fix(nv-main): orchestrator must not cross-post status across chains`
- **#404** `fix(spine): no meta-acknowledgements + close chains explicitly`
- **#405** `fix(a2a): peer-affinity respects thread_id when sender supplied one`
- **#406** `fix(spine): consolidate chain-reporting to 5 rules with [MUST] markers`

### nv-dashboard (6 PRs)
- **#390** `feat(dashboard): recognize the telegram channel adapter`
- **#395** `fix(dashboard): channels list — drop wrong prefix map, exclude helper modules`
- **#396** `fix(dashboard): drop "Global Memory" CLAUDE.md scope retired in v2`
- **#397** `feat(dashboard): clickable session IDs in Admin → Sessions`
- **#399** `fix(dashboard): codex cost — switch to unified ccusage CLI`
- **#400** `fix(dashboard): fold cli_response payloads in thread view`

### nv-slang (3 PRs)
- **#386** `feat(slang-mcp): mandate DeepWiki + GitHub research in summon and continuation prompts`
- **#393** `feat(nv-slang): code-changes invariant + workflow tightening + identity restoration`
- **#407** `feat(slang-triage): principal-engineer rewrite — research, solution space, always forward`

### nv-slangpy (3 PRs)
- **#394** `feat(nv-slangpy): code-changes invariant split + slangpy-implement signal restoration`
- **#408** `feat(slangpy-triage): specialist workflow — DeepWiki + local + gh, always forward`
- **#409** `feat(slangpy): register slangpy-triage / fixer / reviewer types`

### nv-nanoclaw (1 PRs)
- **#392** `feat(nv-nanoclaw): code-changes invariant split + writer rules + workflow tightening`

## 📅 2026-05-19

### nv-main (6 PRs)
- **#369** `Rebase nv-main on upstream/main v2.0.64 — cli_scope, ncl, A2A in_reply_to + L2 guard, drop onecli-gateway/add-deltachat`
- **#377** `Sync nv-main with upstream/main (2026-05-19)`
- **#382** `feat(nv-main): tee container stdio to per-session log files`
- **#383** `fix(nv-main): enable contrib/non-free apt components in base image`
- **#385** `fix(nv-main): self-heal container_configs row on first spawn`
- **#384** `feat(nv-main): ncl sessions messages — read-only transcript verb`

### nv-dashboard (2 PRs)
- **#371** `Rebase nv-dashboard on upstream/main v2.0.64 — pixel-office + a2a inspector + ccusage 19+ + paginate`
- **#379** `Sync nv-dashboard with upstream/main (2026-05-19)`

### nv-slang (1 PRs)
- **#372** `Rebase nv-slang stacked on wip/nv-main — slang skills, slang-mcp, slang-github-webhook (moved from nv-main #357), slang-reviewer`

### nv-slangpy (2 PRs)
- **#373** `Rebase nv-slangpy on upstream/main v2.0.64 — skill-discovery context for SlangPy agents (#297)`
- **#380** `Sync nv-slangpy with upstream/main (2026-05-19)`

### nv-nanoclaw (2 PRs)
- **#374** `Rebase nv-nanoclaw on upstream/main v2.0.64 — base-nanoclaw + nanoclaw-reviewer coworker (Devin PR review #350)`
- **#381** `Sync nv-nanoclaw with upstream/main (2026-05-19)`

## 📅 2026-05-15

### nv-main (1 PRs)
- **#352** `fix(mcp-registry): reap supergateway descendants on stop + log /servers/restart callers`

### nv-slang (1 PRs)
- **#351** `feat(slang-mcp): gate on_thread_create SummonView post behind DISCORD_POST_SUMMON`

## 📅 2026-05-14

### nv-main (4 PRs)
- **#336** `ci(nv-main): catch silent-empty-workflow-body failure mode`
- **#338** `fix(host-sweep): stale CLAUDE.md detect survives host restarts`
- **#341** `feat(nv-main): add chain-reporting protocol to base spine`
- **#345** `fix(nv-main): fetch-skills compares tree-sha, not just branch name`

### nv-dashboard (3 PRs)
- **#337** `fix(dashboard): always bind new coworkers to admin's messaging group`
- **#343** `fix(dashboard): unread badges propagate correctly + don't auto-mark on view`
- **#344** `fix(dashboard): hidden-session count + Create Modal type-cache regression`

### nv-slang (6 PRs)
- **#334** `feat(nv-slang): add slang-reviewer coworker + slang-pr-review workflow`
- **#333** `feat(nv-slang): add optional peer-review step to slang-fix-issue`
- **#335** `fix(nv-slang): reformat workflow steps to numbered-list (composer compat)`
- **#339** `fix(nv-slang): peer-review quietness rule + active-work sentinel`
- **#342** `feat(nv-slang): draft-PR mode + 5-bullet chain reporting`
- **#347** `feat(slang-mcp): DISCORD_READ_ONLY env gate for Discord-write paths`

## 📅 2026-05-13

### nv-main (12 PRs)
- **#331** `feat(nv-main): add session-direct ingress for dashboard a2a admin replies`
- **#326** `fix(nv-main): drop slang-only workflow refs from buddy applies-to`
- **#324** `chore(nv-main): remove project-specific workflows (slang owns triage-issue/fix-issue/discord-answer)`
- **#320** `docs(spines/base): strengthen append_learning trigger conditions`
- **#318** `docs(spines/base): clarify send_card scope vs send_message routing`
- **#314** `fix: SQL injection, timestamp residual, and uncaught readdirSync crash`
- **#313** `style: format mcp-registry.ts`
- **#310** `fix(approvals): create pending_approvals row before DM delivery check`
- **#309** `fix: prevent MCP subprocess leak via stateful mode + process group kill`
- _+3 more: #308, #304, #301_

### nv-dashboard (13 PRs)
- **#332** `feat(dashboard): /api/chat/send-to-session for a2a admin replies`
- **#330** `fix(dashboard): allow admin to reply in own coworker a2a sessions`
- **#329** `fix(dashboard): drop bad parentId fallback in a2a inspector button`
- **#328** `fix(dashboard): a2a inspector lookup uses a2a_session_sources table`
- **#327** `feat(nv-dashboard): filter overlay editor by coworker workflows (extends-aware)`
- **#321** `fix(dashboard): make a2a session chat icon clickable`
- **#319** `fix(dashboard): restore a2a_peer resolution for session purple badge`
- **#317** `fix(dashboard): card-render ReferenceError + asset cache-busting`
- **#316** `fix(dashboard): remove undefined slug ref breaking session list`
- _+4 more: #315, #312, #311, #300_

### nv-slang (2 PRs)
- **#323** `feat(nv-slang): add slang-triage-issue workflow + retarget slang triager binding`
- **#325** `feat(nv-slang): add slang-fix-issue + slang-discord-answer workflows + critique overlay`

## 📅 2026-05-12

### nv-main (6 PRs)
- **#265** `feat(nv-main): add optional overlays param to create_agent MCP tool`
- **#274** `feat(nv-main): port overlay-config DB column from nv-nanoclaw #267`
- **#275** `refactor(nv-main): simplify critique overlay — drop file-writing ceremony`
- **#276** `ci(nv-main): add path-guard for nv-* overlay branches`
- **#277** `feat(nv-main): external skill registry — skill-source in coworker-types.yaml`
- **#294** `ci(nv-main): add fetch-skills + build step to CI pipeline`

### nv-dashboard (5 PRs)
- **#266** `feat(nv-dashboard): overlay selection UI + MCP token race fix`
- **#280** `chore(nv-dashboard): drop legacy groups/global + claude-md-compose`
- **#281** `test(nv-dashboard): add overlays column to createDashboardTestDb`
- **#298** `chore(nv-dashboard): re-land #280 (drop legacy groups/global + claude-md-compose)`
- **#299** `fix(dashboard): persist overlay selection in getCwCoworkers merge`

### nv-slang (5 PRs)
- **#268** `feat(nv-slang): remove overlays from slang coworker-types.yaml`
- **#272** `chore(nv-slang): strip leaked nv-main files + clean rebuild`
- **#278** `feat(nv-slang): add skill-source for shader-slang/slang-skills registry`
- **#292** `chore(nv-slang): remove bundled skills — fetched from shader-slang/slang-skills`
- **#296** `feat(nv-slang): add skill-discovery context for agents`

### nv-slangpy (5 PRs)
- **#269** `feat(nv-slangpy): remove overlays from slangpy coworker-types.yaml`
- **#273** `chore(nv-slangpy): strip leaked nv-main files + clean rebuild`
- **#279** `feat(nv-slangpy): add skill-source for shader-slang/slang-skills registry`
- **#293** `chore(nv-slangpy): remove bundled skills — fetched from shader-slang/slang-skills`
- **#297** `feat(nv-slangpy): add skill-discovery context for agents`

### nv-nanoclaw (2 PRs)
- **#267** `feat(nv-nanoclaw): per-agent overlay composition pipeline + migration`
- **#271** `chore(nv-nanoclaw): simplify overlay migration — drop backfill`

## 📅 2026-05-11

### nv-main (10 PRs)
- **#241** `fix(host-sweep): break spawn-kill loop after container crash`
- **#243** `fix(nv-main): close refreshDestinations closure leak + pass MCP tool inventory`
- **#244** `fix(nv-main): close composer-drift — slim base-common + backtick extends + restore base-nanoclaw skill`
- **#245** `feat(nv-main): daily log rotation with copytruncate (systemd-fd-safe)`
- **#247** `fix(nv-main): extends-note em-dash — no phantom Unknown-slash-ref warnings (regression from #244)`
- **#254** `feat(nv-main): cross-coworker dashboard file+message forwarding`
- **#256** `fix(nv-main): cross-coworker delivery — owner-only + a2a thread lookup`
- **#259** `fix(nv-main): disable bwrap sandbox in Codex config.toml + Claude settings.json`
- **#261** `feat(nv-main): enable codex_hooks experimental feature`
- **#262** `fix(nv-main): pr_session_mappings NULL thread_id insert failure`

### nv-dashboard (6 PRs)
- **#242** `feat(dashboard): remove chat tab, unify admin messages view`
- **#246** `feat(nv-dashboard): add GET /api/coworkers — list endpoint to round out POST`
- **#248** `chore(nv-dashboard): drop leaked agent-runner/agents.instructions.md — nv-main owns`
- **#252** `feat(nv-dashboard): a2a session visibility + approval feedback + fullscreen fix`
- **#253** `fix(nv-dashboard): collapsible relay messages + self-echo filter + unread polish`
- **#255** `fix(nv-dashboard): inbox attachment rendering + thread file links`

### nv-slang (2 PRs)
- **#249** `chore(nv-slang): drop leaked agent-runner/agents.instructions.md — nv-main owns`
- **#258** `fix(slang-mcp): remove GITHUB_API_BASE from OneCLI env vars`

### nv-slangpy (1 PR)
- **#250** `chore(nv-slangpy): drop leaked agent-runner/agents.instructions.md — nv-main owns`

### nv-nanoclaw (1 PR)
- **#251** `chore(nv-nanoclaw): drop leaked agent-runner/agents.instructions.md — nv-main owns`

## 📅 2026-05-10

### nv-main (3 PRs)
- **#237** `feat(nv-main): A/B/C/D test infra + buddy overlay + proxy/codex fixes`
- **#239** `feat(nv-main): PR→session mapping for webhook routing`
- **#240** `feat(nv-main): auto-detect PR creation and prompt report_pr_created`

### nv-slang (1 PR)
- **#238** `feat(nv-slang): discord support types + REST API fallback + A/B test coworker types`

## 📅 2026-05-08

### nv-main (18 PRs)
- **#235** `feat(nv-main): webhook PR→session round-trip routing`
- **#234** `feat(nv-main): add coworker bootstrap skill + expanded setup`
- **#231** `feat(nv-main): GitHub webhook receiver + mcp tool instruction files`
- **#230** `style(nv-main): reformat ternary in renderCoworkerSpine for readability`
- **#226** `chore(nv-main): split working-session delta (replaces #224)`
- **#221** `fix(nv-main): move dashboard-ingress into nv-main so core builds standalone`
- **#215** `fix(nv-main): skip self-referential a2a routing; raise idle-end default to 20 min; revert scheduling.md from base-common`
- **#214** `feat(nv-main): mandatory watchdog pattern for long-running tasks`
- **#211** `fix(nv-main): pass-through subagents in plan-gate and state-reset hooks`
- _+9 more: #210, #209, #207, #204, #199, #198, #193, #192, #188_

### nv-dashboard (27 PRs)
- **#232** `fix(nv-dashboard): channel-registry test + chat-sdk-bridge + index updates`
- **#223** `fix(nv-dashboard): sync dashboard-ingress from nv-main (restore for clean merges)`
- **#222** `fix(nv-dashboard): drop dashboard-ingress ownership (now lives in nv-main)`
- **#220** `fix(nv-dashboard): replace ghost shape filter with activity_count field for session visibility`
- **#219** `fix(nv-dashboard): remove InstructionsLoaded from session-flow (pure noise)`
- **#218** `fix(nv-dashboard): fix fetchCwThread guard and fetch-error handling`
- **#217** `feat(nv-dashboard): make session name in active block clickable to open thread`
- **#216** `fix(nv-dashboard): null-guard nanoclaw_session_id before rendering thread action buttons`
- **#213** `feat(nv-dashboard): add pin/rename/timeline action buttons to thread header`
- _+18 more: #208, #206, #205, #203, #202, #201, #200, #197, #196, #195, #194, #191, #190, #189, #187, #184, #183, #182_

### nv-slang (3 PRs)
- **#186** `fix(nv-slang): MCP server hygiene — env-vars, SQL injection, debug gate, stale requirements`
- **#212** `fix(nv-slang): add build watchdog and parent notification to slang-implement verify step`
- **#228** `chore(nv-slang): split working-session delta (replaces #224)`

### nv-slangpy (1 PR)
- **#229** `chore(nv-slangpy): split working-session delta (replaces #224)`

### nv-nanoclaw (1 PR)
- **#227** `chore(nv-nanoclaw): split working-session delta (replaces #224)`

## 📅 2026-05-07

### nv-main (9 PRs)
- **#148** `fix(agent-runner): handle HTTP MCP servers + route codex MCP through NVIDIA_API_KEY`
- **#149** `fix(agent-runner): use env_vars allowlist to keep OneCLI secrets out of codex TOML`
- **#153** `fix(agent-to-agent): add refreshDestinationsForAgentGroup helper`
- **#162** `chore(nv-main): move 4 token-named files to their owning buckets`
- **#168** `chore(nv-main): remove /setup and /add-coworkers — owned by nv-coworkers`
- **#169** `fix(nv-main): restore setup/SKILL.md to origin/main version (partial revert of #168)`
- **#175** `feat(nv-main): per-thread plumbing + sdk_session_routes + thread-aware a2a + backfill`
- **#178** `fix(nv-main): A2A round-trip envelope — reply routes to originating source session`
- **#180** `feat(nv-main): session display titles — schema + helper`

### nv-dashboard (6 PRs)
- **#154** `fix(dashboard): refresh destinations projection after mutating agent_destinations`
- **#163** `chore(nv-dashboard): restore 9 phantom deletes + adopt dashboard-ingress.*`
- **#176** `feat(nv-dashboard): Slack-threads UI + Timeline route-joins + session slugs + a2a inspector`
- **#177** `fix(nv-dashboard): drop duplicated session block from Recent Events + restore author-colour palette`
- **#179** `fix(nv-dashboard): strict container matching + 404 on explicit-thread misses`
- **#181** `feat(nv-dashboard): session display titles + pixel-office hit-test + artifact shell + honest pagination`

### nv-slang (1 PR)
- **#164** `chore(nv-slang): restore 9 phantom deletes + adopt architecture-alignment-slang.test.ts`

### nv-slangpy (1 PR)
- **#165** `chore(nv-slangpy): restore 9 phantom-deleted base files`

### nv-nanoclaw (1 PR)
- **#166** `chore(nv-nanoclaw): restore 9 phantom-deleted base files`

## 📅 2026-05-06

### nv-main (6 PRs)
- **#118** `fix(nv-main): require >=1 codex-critique per task before any external post`
- **#122** `feat(nv-main): license: MIT + rename base-plan→plan + critique→critique-overlay`
- **#138** `chore(nv-main): route session-local changes to nv-main`
- **#143** `skill(split-commit): add name-based ownership + path-prefix anti-pattern`
- **#145** `fix(nv-main): mtime-refresh skill mirrors so upstream changes propagate`
- **#147** `fix(nv-main): prune orphaned agent.md mirrors on wake`

### nv-dashboard (4 PRs)
- **#119** `fix(nv-dashboard): newest-first ordering, ghost-filtered sub-sessions, split Timeline picker, merge Metrics into Overview`
- **#120** `fix(nv-dashboard): attribute Codex cost to coworker; guard MCP /tools 401 parse`
- **#121** `fix(nv-dashboard): per-server tool counts in Admin → Infra MCP list`
- **#139** `chore(nv-dashboard): route session-local changes to nv-dashboard`

### nv-slang (4 PRs)
- **#117** `feat(nv-slang): annotate externally-posting slang-mcp tools with openWorldHint`
- **#124** `feat(nv-slang): license: MIT + flatten slang-maintain-release-report allowed-tools`
- **#140** `chore(nv-slang): route session-local changes to nv-slang`
- **#144** `test(nv-slang): update slang-reader scenario tests for 6→2 workflow model`

### nv-slangpy (2 PRs)
- **#125** `feat(nv-slangpy): add license: MIT to 9 project assets`
- **#141** `chore(nv-slangpy): route session-local changes to nv-slangpy`

### nv-nanoclaw (2 PRs)
- **#123** `feat(nv-nanoclaw): add license: MIT to 9 project assets`
- **#142** `chore(nv-nanoclaw): route session-local changes to nv-nanoclaw`

## 📅 2026-05-05

### nv-main (30 PRs)
- **#115** `fix(nv-main): generalize critique gate to openWorld-annotated MCP tools`
- **#114** `fix(nv-main): honor disable_overlays at runtime hook injection + R20 test`
- **#111** `fix(nv-main): per-instance CA bundle path for host-side MCP servers`
- **#109** `fix(nv-main): promote <message to="..."> to base-common invariant + plumb routing through follow-up pushes`
- **#108** `feat(nv-main): invert new_session default — fresh session per fire, opt out via new_session:false`
- **#106** `fix(agent-runner): honor new_session in the follow-up push path too (fixes PR #58 bypass)`
- **#105** `feat(nv-main): log per-turn usage in agent-runner (enables cost A/B testing)`
- **#104** `feat(nv-main): forward ENABLE_PROMPT_CACHING_1H_BEDROCK + FORCE_PROMPT_CACHING_5M into containers`
- **#103** `feat(nv-main): wire new_session end-to-end for scheduled tasks (fixes dead feature from #58)`
- _+21 more: #102, #100, #97, #96, #95, #93, #92, #90, #84, #83, #82, #80, #77, #75, #73, #72, #70, #69, #67, #63, #62_

### nv-dashboard (9 PRs)
- **#74** `fix(dashboard): Create modal lists spine types + delete cleans OneCLI + reverse dests`
- **#76** `fix(dashboard): Create modal enforces single-type selection`
- **#89** `feat(dashboard): add /api/health liveness/readiness endpoint`
- **#101** `fix(nv-dashboard): stop one bad row from bisecting the channel view`
- **#107** `fix(nv-dashboard): drop strict-auth gate on /exec endpoint`
- **#110** `fix(nv-dashboard): style agent-to-agent messages distinctly in coworker view`
- **#112** `fix(nv-dashboard): promote nanoclaw v2 session to primary identity; nest SDK UUIDs as sub-sessions`
- **#113** `fix(dashboard): subtract cached tokens from codex INPUT column`
- **#116** `fix(nv-dashboard): thread disable_overlays through on-demand spine preview`

### nv-slang (7 PRs)
- **#65** `refactor(nv-slang): move spine + workflows to new layout`
- **#71** `test(nv-slang): update spine-size ceiling post-refactor`
- **#85** `refactor(nv-slang): sweep stale /workspace/group → /workspace/agent`
- **#87** `fix(nv-slang): drop stale codex-critique from spine skills array`
- **#94** `fix(nv-slang): drop backticked /regenerate-toc from slang-document WORKFLOW.md`
- **#98** `feat(nv-slang): declare slang-maintain-release-report in slang-common skills`
- **#99** `chore(nv-slang): sync slang-fixer and slang-triage coworker bundles with cleaned prod instructions`

### nv-slangpy (2 PRs)
- **#66** `refactor(nv-slangpy): move spine + workflows to new layout`
- **#88** `fix(nv-slangpy): drop stale codex-critique from spine skills array`

### nv-nanoclaw (3 PRs)
- **#64** `refactor(nv-nanoclaw): move spine + workflows to new layout`
- **#86** `fix(nv-nanoclaw): drop stale codex-critique from spine skills array`
- **#91** `fix(nv-nanoclaw): drop dup base workflows from nanoclaw-common + -writer`

## 📅 2026-05-04

### nv-main (1 PR)
- **#58** `feat(agent-runner): new_session flag for scheduled tasks`

### nv-dashboard (1 PR)
- **#59** `feat(dashboard): include @ccusage/codex metrics in cost panel`

## 📅 2026-05-02

### nv-main (3 PRs)
- **#51** `fix(onboard-coworker): auto-wire destinations from YAML bundle after create_agent`
- **#54** `fix(container): git push via OneCLI proxy Basic auth injection`
- **#57** `fix(container): set git insteadOf rewrite at container startup for HTTPS push via OneCLI proxy`

### nv-slang (2 PRs)
- **#50** `fix(slang-mcp): merge system CA bundle with OneCLI CA for SSL verification`
- **#56** `fix(slang-mcp): OneCLI proxy auth + SSL CA bundle merge`

## 📅 2026-05-01

### nv-slang (1 PR)
- **#49** `fix(slang-mcp): replace static PAT with OneCLI proxy auth`

## 📅 2026-04-30

### nv-main (11 PRs)
- **#48** `fix(container): disable bwrap in Codex config.toml for Docker compatibility`
- **#47** `fix(container): set GIT_SSL_CAINFO so git works through OneCLI proxy`
- **#46** `fix(sweep): kill+respawn stale containers instead of /clear`
- **#45** `feat(nv-main): Codex provider parity — skill body loading, hook enforcement, additional dir discovery`
- **#44** `fix(onecli): namespace CA cert files to avoid multi-instance collision`
- **#43** `fix(mcp): restore OneCLI proxy for host-side MCP servers`
- **#42** `fix(gpu): detect NVIDIA runtime via docker info, prefer --runtime=nvidia`
- **#41** `fix(critique-overlay): resist scope-shrinkage and circular tests in PLAN_REVIEW`
- **#40** `feat: codex-critique direct + critique enforcement + intent-router + GPU + workflow-state`
- _+2 more: #38, #36_

### nv-dashboard (1 PR)
- **#39** `feat(nv-dashboard): add Metrics panel with cost tracking, activity, users, channels`

### nv-slang (1 PR)
- **#37** `fix(slang-mcp): honor SSL_CERT_FILE for OneCLI proxy trust`

## 📅 2026-04-29

### nv-main (3 PRs)
- **#24** `docs: rewrite split-commit skill from battle-tested nv-* branch split`
- **#26** `fix: name-based migration detection, prettier, debug checklist`
- **#25** `fix(overlays): enforce plan + critique gates via runtime hooks`

### nv-slang (4 PRs)
- **#27** `fix: ensure pr-knowledge DB schema exists before querying`
- **#28** `fix: drop leaked session-manager.ts that regresses path-traversal guard`
- **#29** `fix(slang): remove plan-overlay (merged into critique-overlay)`
- **#32** `fix(nv-slang): strip 5 non-slang files leaked from prod install`

### nv-slangpy (1 PR)
- **#30** `fix(slangpy): remove plan-overlay (merged into critique-overlay)`

### nv-nanoclaw (1 PR)
- **#31** `fix(nanoclaw): remove plan-overlay (merged into critique-overlay)`

## 📅 2026-04-28

### nv-main (5 PRs)
- **#8** `docs: add onboard-project section to USAGE.md`
- **#9** `fix: pidfile singleton guard`
- **#18** `Fix container timeout ceiling + add GPU passthrough`
- **#19** `fix: parse JSON array for allowed_mcp_tools`
- **#12** `fix: add discord.com to NO_PROXY (keep api.github.com routed through proxy)`

### nv-dashboard (1 PR)
- **#10** `fix: dashboard responsive layout + rem font units`

### nv-slang (2 PRs)
- **#11** `feat: Discord support bot with feedback collector`
- **#13** `feat(nv-slang): Discord support bot with feedback collector`

<!-- END AUTO -->
