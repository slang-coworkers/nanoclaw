---
title: "Agent Routing: MCP Servers & Gateways"
type: concept
group: agent-routing
tags: [mcp, codex, critique-gate, slang-mcp, slangd, lsp, service-restart, graphql, budget, toolchain]
source_count: 20
---

# Agent Routing: MCP Servers & Gateways

Operational rules for the codex-critique gate overlay, the slang-mcp server, slangd LSP probing, and related MCP tooling.

## Codex Critique Gate: Overview

When the `critique-gate` overlay is active (marker file `/workspace/agent/.overlay-critique-gate` exists), delivery actions — `send_message` with `[Fix Report]`/`[Resolution]` markers AND `gh pr create` / `gh api .../pulls` — are blocked by PreToolUse hook `/app/hooks/gate-critique-on-deliver.sh` until codex critique is recorded in a specific machine-parseable format. State lives in `/workspace/.claude/workflow-state.json` (`.critique_stages`, `.critique_verdicts`) ([[wiki/learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md]]).

### Required Format

Read `/workspace/agent/.critique-required-stages` (JSON array, e.g. `["PLAN_REVIEW","CODE_REVIEW","OUTPUT_REVIEW"]`). If absent/empty, the gate falls back to "any 1 critique round." If stages are listed, make ONE separate `mcp__codex__codex` call PER stage (NOT `codex-reply` — replies don't carry the STAGE marker). Each call: the PROMPT must contain a line matching `STAGE:[[:space:]]*[A-Z_]+`, e.g. `STAGE: PLAN_REVIEW`. The codex RESPONSE must end with `### Verdict` immediately followed by a line containing only `approve` or `must-fix`. Parser: `sed -n '/^### *Verdict/{n;p;}'`. Make the calls **sequentially** — parallel calls race and drop a stage ([[wiki/learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md]]).

The stage detector keys on the FIRST stage-keyword in the codex prompt — lead with the bare `STAGE:` line and don't name any other stage earlier in the body ([[wiki/learnings/1780971403094-critique-gate-stage-detector-keys-on-the-first-sta.md]]).

### Verdicts and Thread Stickiness

The gate records stage verdicts ONLY from a fresh top-level `mcp__codex__codex` call, NOT from a `codex-reply` round. After addressing must-fix items, run a NEW `mcp__codex__codex` call for that stage to get the gate to record the approve verdict. Don't loop re-replying expecting the gate to flip ([[wiki/learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md]], [[wiki/learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md]], [[wiki/learnings/1782439747524-codex-critique-gate-tracks-fresh-call-verdicts-not.md]]).

The `must-fix` verdict is sticky within a reused codex thread — subsequent approve rounds on the same thread are not recorded correctly as approve. Start a new codex critique session per deliverable rather than `codex-reply`-ing past a must-fix round ([[wiki/learnings/1781386154716-codex-critique-gate-start-a-fresh-codex-session-pe.md]], [[wiki/learnings/1781386183865-critique-gate-output-review-is-sticky-within-a-reu.md]]).

Use `codex-reply` for the iterative back-and-forth on must-fix items (cheaper, keeps context), but once codex says `approve`, run ONE fresh `mcp__codex__codex` call for that stage to get the gate to record the approve verdict ([[wiki/learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md]]).

The gate requires `OUTPUT_REVIEW = approve` specifically; `PLAN_REVIEW` and `CODE_REVIEW` only need count ≥ 1 (any verdict) ([[wiki/learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md]]).

### Codex Workspace and Path Rules

Codex (`mcp__codex__codex`) runs in a SEPARATE container that shares `/workspace` but NOT `/tmp`. Stage review artifacts under `/workspace/...` (e.g. `/workspace/agent/reports/<n>-pr-body.md`) and pass that path. Set `sandbox: "danger-full-access"` (read-only is rejected by a PreToolUse hook in Docker). Write the PR body with the Write tool to a `/workspace` path FIRST (separate step), run the 3 critique stages, then `gh pr create --body-file <that path>` ([[wiki/learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md]]).

The critique-gate PreToolUse hook denies the ENTIRE bash command when it blocks `gh pr create` — a heredoc that precedes `gh pr create` in a single command never executes. Write the PR body as a separate step first ([[wiki/learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md]]).

### Opening a PR Under the Gate

The clean sequence: (1) run 3 critique stages against the diff + draft deliverable, (2) gate opens once all 3 are recorded, (3) `gh pr create` succeeds, (4) write the real PR URL into the deliverable, (5) one `codex-reply` re-verify round flips OUTPUT_REVIEW to approve. Don't fabricate the URL up front — describe the PR as "pending" in the pre-creation draft, fill the real URL after ([[wiki/learnings/1780325263478-codex-critique-gate-open-the-pr-before-claiming-it.md]]).

### PR Review: Reviewer Gate

When reviewing a change to a shared IR classifier or helper with broad blast radius, do NOT issue APPROVE on static review alone. Gate the verdict on a green full-suite CI run. Full-suite CI exercises paths static review systematically under-weights. On a bot DRAFT PR, the auto `pull_request` CI is draft-gated — confirm the fixer dispatched `ci.yml` via `workflow_dispatch` so a real full-suite run exists ([[wiki/learnings/1782454067582-reviewer-gate-the-verdict-on-full-suite-ci-for-bro.md]]).

## slang-mcp Server

### Date Qualifier Bug

`mcp__slang-mcp__github_search_issues` with any date-range qualifier returns zero results — `merged:>=DATE`, `merged:DATE..DATE`, `closed:>=DATE` all return `total_count: 0`. Workaround: drop the date qualifier, sort by recency, then filter client-side by `updated_at`/`closed_at` fields. Also: the tool does NOT populate `merged_at` (always null) — distinguish merged vs closed-unmerged by whether the item appears under an `is:merged` query ([[wiki/learnings/1780906273275-slang-mcp-github-search-issues-date-qualifiers-ret.md]]).

The `slang-mcp` allowlist (`$NANOCLAW_ALLOWED_MCP_TOOLS`) notably does NOT include `github_list_pull_requests` — use `github_search_issues` with `is:pr` qualifiers instead, even when the server IS up ([[wiki/learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md]]).

### Restart Policy

Never `systemctl restart nanoclaw-*` just to pick up MCP server config changes. A service restart SIGKILLs all running agent containers, destroying in-progress sessions (subagents, PR reviews, sweeps). To restart only an MCP server subprocess:
```bash
pkill -f 'haaggarwal.*slang-mcp-server'   # nanoclaw auto-respawns it
```
The host process detects the child died and restarts it. No containers are affected ([[wiki/learnings/legoop-feedback_no_service_restart_for_mcp.md]]).

### Fallback When slang-mcp Is Down

When slang-mcp returns "No such tool available" AND `gh` fails with an invalid `GH_TOKEN`, use the unauthenticated public GitHub REST API with plain `curl`: `curl -s https://api.github.com/repos/shader-slang/slang/issues/<n>`, `curl -sG https://api.github.com/search/issues ...`. Limits: 60 core req/hr + 60 search req/hr. GraphQL is blocked (limit 0), so GitHub Discussions cannot be fetched this way. Discord, Slack, and GitLab (nv-master) all require slang-mcp and are simply unavailable — state that explicitly in the report ([[wiki/learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md]]).

## Slangd LSP Probing

To confirm whether a Slang language-server fix clears a diagnostic bug (e.g. #11532, false errors when opening a module fragment), drive a REAL `slangd` over stdio — do NOT rely on slang-test's `LANG_SERVER` harness (it forces `-periodic-diagnostic-update false`, under which slangd never publishes diagnostics). A minimal LSP client that: initialize → initialized → textDocument/didOpen(the file) → read for ~5s → collect `textDocument/publishDiagnostics`, WILL see the errors within ~1-2s. Framing is LSP-standard `Content-Length: N\r\n\r\n<json>` ([[wiki/learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md]], [[wiki/learnings/1781118241659-verify-language-server-only-diagnostic-fixes-with-.md]]).

A reusable hardened probe lives at `/workspace/agent/wt-slang-11532/expt-logs/probe_slangd.py`. Always run a CONTROL arm (unpatched build) first to prove the probe + repro reproduce the bug before trusting a "fixed" result. `slang-unit-test` cannot link `Workspace`/`getOrLoadModule` symbols (non-`SLANG_API`, `-fvisibility=hidden`) ([[wiki/learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md]]).

## GitHub GraphQL / ProjectsV2 Access

ProjectsV2 (org project boards) require a per-project access grant under the project's settings, separate from org-level Projects permission. The nv-slang-bot App install may have org Projects R/W yet still 403 on a specific board because it lacks the per-project grant. On the dev instance this was worked around with a human PAT path-routed to `/graphql`; prod has no such PAT, so ProjectsV2 writes are generally not available to prod coworkers. The OneCLI path quirk: `/graphql*` won't match the bare `/graphql` — use the literal ([[wiki/learnings/legoop-project_graphql_path_routing.md]]).

---
**Source learnings (20):**
- [[wiki/learnings/1780325263478-codex-critique-gate-open-the-pr-before-claiming-it.md]] — codex-critique gate: open the PR before claiming it in OUTPUT_REVIEW
- [[wiki/learnings/1780971403094-critique-gate-stage-detector-keys-on-the-first-sta.md]] — critique-gate stage detector keys on first stage-keyword
- [[wiki/learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md]] — Verify slangd diagnostics with a manual stdio LSP probe
- [[wiki/learnings/1781118241659-verify-language-server-only-diagnostic-fixes-with-.md]] — Verify language-server-only diagnostic fixes with real slangd probe
- [[wiki/learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md]] — codex-critique: /workspace not /tmp, gate denies whole bash block
- [[wiki/learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md]] — critique-gate: STAGE marker in codex PROMPT + Verdict block in RESPONSE
- [[wiki/learnings/1781386154716-codex-critique-gate-start-a-fresh-codex-session-pe.md]] — codex-critique gate: start a fresh codex session per deliverable
- [[wiki/learnings/1781386183865-critique-gate-output-review-is-sticky-within-a-reu.md]] — critique-gate OUTPUT_REVIEW is sticky within a reused codex thread
- [[wiki/learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md]] — critique-gate records verdict from fresh codex calls, not codex-reply
- [[wiki/learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md]] — codex-critique gate records stage verdicts only from fresh staged call
- [[wiki/learnings/1782439747524-codex-critique-gate-tracks-fresh-call-verdicts-not.md]] — codex critique-gate tracks FRESH-call verdicts, not codex-reply
- [[wiki/learnings/1782454067582-reviewer-gate-the-verdict-on-full-suite-ci-for-bro.md]] — Reviewer gate: require full-suite CI for broad-blast-radius changes
- [[wiki/learnings/1780906273275-slang-mcp-github-search-issues-date-qualifiers-ret.md]] — slang-mcp github_search_issues date qualifiers return empty
- [[wiki/learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md]] — Daily-report fallback when slang-mcp server is down
- [[wiki/learnings/legoop-feedback_no_service_restart_for_mcp.md]] — Restart only the specific MCP subprocess, not the whole service
- [[wiki/learnings/legoop-project_graphql_path_routing.md]] — GitHub GraphQL / ProjectsV2 access needs per-project grant
- [[wiki/learnings/1781539485742-api-budget-cap-blocks-llm-subagent-dispatch-not-di.md]] — API budget cap blocks LLM subagent dispatch
- [[wiki/learnings/1780623682428-when-ci-regresses-but-git-diff-in-the-bisect-range.md]] — When CI regresses but git diff is empty, suspect the toolchain
- [[wiki/learnings/1780623760932-ci-failure-reports-surface-unpinned-toolchain-inst.md]] — CI failure reports: surface unpinned toolchain installs
- [[wiki/learnings/1781055257855-slang-ci-exposed-to-unpinned-toolchain-drift.md]] — Slang CI exposed to unpinned toolchain drift
_Catalog: [[wiki/index.md]]_
