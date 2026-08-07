---
title: "Agent Routing: MCP Servers & Gateways"
type: concept
group: agent-routing
tags: [mcp, codex, critique-gate, slang-mcp, slangd, lsp, service-restart, graphql, budget, toolchain]
source_count: 25
---

# Agent Routing: MCP Servers & Gateways

Operational rules for the codex-critique gate overlay, the slang-mcp server, slangd LSP probing, the OneCLI credential gateway, and related MCP tooling.

## TL;DR
- **The critique gate records verdicts only from a FRESH top-level `mcp__codex__codex` call**, one per stage, made sequentially. `codex-reply` rounds are for iterating on must-fix items — they never move the gate, and `must-fix` is sticky within a reused thread. After codex says approve, make one fresh staged call.
- **Stage detection keys on the FIRST stage keyword in the prompt.** Lead with a bare `STAGE: <NAME>` line and name no other stage earlier in the body. The response must end with `### Verdict` followed by a line containing only `approve` or `must-fix`.
- **The gate needs `OUTPUT_REVIEW = approve` specifically**; other stages need only count ≥ 1.
- **Codex runs in a separate container that shares `/workspace` but not `/tmp`.** Stage every artifact codex must read under `/workspace`, and set `sandbox: "danger-full-access"`.
- **The gate's PreToolUse hook denies the WHOLE bash command**, so a heredoc that precedes a blocked `gh pr create` never runs. Write the PR body as its own step, then create the PR, then fill in the real URL — never fabricate it up front.
- **Gate an APPROVE on green full-suite CI for broad-blast-radius changes**, not static review. On a draft PR the auto CI is draft-gated; confirm a `workflow_dispatch` run exists.
- **An empty MCP search result is non-signal, never evidence of absence.** `github_search_issues` has returned zero for date-qualified queries and, during an extended outage, for *every* query including trivially-matching ones. Never read empty as "no duplicate issue" or "the merge queue is frozen" — fall back to `github_list_issues(state=ALL)` + client-side filter, or REST `pulls/<N>` / `commits?sha=master`.
- **`merged_at` is never populated by that tool**; determine merge state from REST `.merged`/`.state`/`.draft`.
- **Restart the failing MCP subprocess, not the service.** `systemctl restart nanoclaw-*` SIGKILLs every running agent container and destroys in-progress work; `pkill -f '<mcp-server>'` lets the host respawn the child with no container impact.
- **Distinguish a credential outage from a cold start before retrying.** A 401 on reads that reproduces across sessions and channels is a vault/token failure only an operator can fix — 2-3 attempts confirms it. Preserve the unposted artifact, attach it upstream, and report `blocked` with exact error strings; never post a partial report.
- **Credential injection at the gateway is PATH-SCOPED.** An intact proxy env is necessary but not sufficient: a path with no rule for this agent returns 401/403 even though the credential exists. Never conclude "the upstream object is gone" from a scoped read.
- **Never `unset HTTP_PROXY` to work around a 403** — it strips the injected token entirely and drops the rate limit from 6000/hr to 60/hr.
- **Drop `-f` and print `%{http_code}` the moment a fetch returns nothing you cannot explain.** `curl -sf` renders an auth failure as empty stdout, byte-identical to a legitimate absence. Pair every such read with a positive control on a path known to be in scope.
- **The git wire protocol is not path-gated the way the REST API is.** `git ls-remote` and a `--filter=blob:none` scratch clone answer ref existence, default-branch, and `merge-base --is-ancestor` reachability against foreign orgs over the same proxy.
- **Branch-protection endpoints are unavailable on a scoped token**, so "is this check required?" must be answered from merge evidence, not the required-contexts list.
- **ProjectsV2 boards need a per-project access grant** separate from org-level Projects permission; prod coworkers generally cannot write them. Route the literal `/graphql`, not `/graphql*`.
- **Probe a language server with a real `slangd` over stdio, with a control arm on an unpatched build.** slang-test's `LANG_SERVER` harness disables periodic diagnostics, so it never publishes the diagnostics you are trying to observe.

## Codex Critique Gate: Overview

When the `critique-gate` overlay is active (marker file `/workspace/agent/.overlay-critique-gate` exists), delivery actions — `send_message` with `[Fix Report]`/`[Resolution]` markers AND `gh pr create` / `gh api .../pulls` — are blocked by PreToolUse hook `/app/hooks/gate-critique-on-deliver.sh` until codex critique is recorded in a specific machine-parseable format. State lives in `/workspace/.claude/workflow-state.json` (`.critique_stages`, `.critique_verdicts`) ([critique-gate: STAGE marker in codex PROMPT + '### Verdict' block in codex RESPONSE, one call per stage](../learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md)).

### Required Format

Read `/workspace/agent/.critique-required-stages` (JSON array, e.g. `["PLAN_REVIEW","CODE_REVIEW","OUTPUT_REVIEW"]`). If absent/empty, the gate falls back to "any 1 critique round." If stages are listed, make ONE separate `mcp__codex__codex` call PER stage (NOT `codex-reply` — replies don't carry the STAGE marker). Each call: the PROMPT must contain a line matching `STAGE:[[:space:]]*[A-Z_]+`, e.g. `STAGE: PLAN_REVIEW`. The codex RESPONSE must end with `### Verdict` immediately followed by a line containing only `approve` or `must-fix`. Parser: `sed -n '/^### *Verdict/{n;p;}'`. Make the calls **sequentially** — parallel calls race and drop a stage ([critique-gate: STAGE marker in codex PROMPT + '### Verdict' block in codex RESPONSE, one call per stage](../learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md)).

The stage detector keys on the FIRST stage-keyword in the codex prompt — lead with the bare `STAGE:` line and don't name any other stage earlier in the body ([critique-gate stage detector keys on the FIRST stage-keyword in the codex prompt — lead with the bare STAGE: line](../learnings/1780971403094-critique-gate-stage-detector-keys-on-the-first-sta.md)).

### Verdicts and Thread Stickiness

The gate records stage verdicts ONLY from a fresh top-level `mcp__codex__codex` call, NOT from a `codex-reply` round. After addressing must-fix items, run a NEW `mcp__codex__codex` call for that stage to get the gate to record the approve verdict. Don't loop re-replying expecting the gate to flip ([codex-critique gate records stage verdicts only from a fresh staged codex call, not from codex-reply](../learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md), [Critique-gate records verdict from fresh codex calls, not codex-reply rounds](../learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md), [codex critique-gate tracks FRESH-call verdicts, not codex-reply re-verifications](../learnings/1782439747524-codex-critique-gate-tracks-fresh-call-verdicts-not.md)).

The `must-fix` verdict is sticky within a reused codex thread — subsequent approve rounds on the same thread are not recorded correctly as approve. Start a new codex critique session per deliverable rather than `codex-reply`-ing past a must-fix round ([codex-critique gate: start a fresh codex session per deliverable, don't codex-reply past a must-fix](../learnings/1781386154716-codex-critique-gate-start-a-fresh-codex-session-pe.md), [Critique-gate OUTPUT_REVIEW is sticky within a reused codex thread](../learnings/1781386183865-critique-gate-output-review-is-sticky-within-a-reu.md)).

Use `codex-reply` for the iterative back-and-forth on must-fix items (cheaper, keeps context), but once codex says `approve`, run ONE fresh `mcp__codex__codex` call for that stage to get the gate to record the approve verdict ([Critique-gate records verdict from fresh codex calls, not codex-reply rounds](../learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md)).

The gate requires `OUTPUT_REVIEW = approve` specifically; `PLAN_REVIEW` and `CODE_REVIEW` only need count ≥ 1 (any verdict) ([codex-critique gate records stage verdicts only from a fresh staged codex call, not from codex-reply](../learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md)).

### Codex Workspace and Path Rules

Codex (`mcp__codex__codex`) runs in a SEPARATE container that shares `/workspace` but NOT `/tmp`. Stage review artifacts under `/workspace/...` (e.g. `/workspace/agent/reports/<n>-pr-body.md`) and pass that path. Set `sandbox: "danger-full-access"` (read-only is rejected by a PreToolUse hook in Docker). Write the PR body with the Write tool to a `/workspace` path FIRST (separate step), run the 3 critique stages, then `gh pr create --body-file <that path>` ([codex-critique + critique-gate: /workspace not /tmp, and the gate denies the whole bash block](../learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md)).

The critique-gate PreToolUse hook denies the ENTIRE bash command when it blocks `gh pr create` — a heredoc that precedes `gh pr create` in a single command never executes. Write the PR body as a separate step first ([codex-critique + critique-gate: /workspace not /tmp, and the gate denies the whole bash block](../learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md)).

### Opening a PR Under the Gate

The clean sequence: (1) run 3 critique stages against the diff + draft deliverable, (2) gate opens once all 3 are recorded, (3) `gh pr create` succeeds, (4) write the real PR URL into the deliverable, (5) one `codex-reply` re-verify round flips OUTPUT_REVIEW to approve. Don't fabricate the URL up front — describe the PR as "pending" in the pre-creation draft, fill the real URL after ([codex-critique gate: open the PR before claiming it in OUTPUT_REVIEW deliverable](../learnings/1780325263478-codex-critique-gate-open-the-pr-before-claiming-it.md)).

### PR Review: Reviewer Gate

When reviewing a change to a shared IR classifier or helper with broad blast radius, do NOT issue APPROVE on static review alone. Gate the verdict on a green full-suite CI run. Full-suite CI exercises paths static review systematically under-weights. On a bot DRAFT PR, the auto `pull_request` CI is draft-gated — confirm the fixer dispatched `ci.yml` via `workflow_dispatch` so a real full-suite run exists ([Reviewer: gate the verdict on full-suite CI for broad-blast-radius changes, not static review alone](../learnings/1782454067582-reviewer-gate-the-verdict-on-full-suite-ci-for-bro.md)).

## slang-mcp Server

### Date Qualifier Bug

`mcp__slang-mcp__github_search_issues` with any date-range qualifier returns zero results — `merged:>=DATE`, `merged:DATE..DATE`, `closed:>=DATE` all return `total_count: 0`. Workaround: drop the date qualifier, sort by recency, then filter client-side by `updated_at`/`closed_at` fields. Also: the tool does NOT populate `merged_at` (always null) — distinguish merged vs closed-unmerged by whether the item appears under an `is:merged` query ([slang-mcp github_search_issues date qualifiers return empty](../learnings/1780906273275-slang-mcp-github-search-issues-date-qualifiers-ret.md)).

The `slang-mcp` allowlist (`$NANOCLAW_ALLOWED_MCP_TOOLS`) notably does NOT include `github_list_pull_requests` — use `github_search_issues` with `is:pr` qualifiers instead, even when the server IS up ([Daily-report fallback when slang-mcp server is down](../learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md)).

### Restart Policy

Never `systemctl restart nanoclaw-*` just to pick up MCP server config changes. A service restart SIGKILLs all running agent containers, destroying in-progress sessions (subagents, PR reviews, sweeps). To restart only an MCP server subprocess:
```bash
pkill -f 'haaggarwal.*slang-mcp-server'   # nanoclaw auto-respawns it
```
The host process detects the child died and restarts it. No containers are affected ([Restarting nanoclaw service kills all running containers and their in-progress work; restart only the specific MCP subprocess instead](../learnings/legoop-feedback_no_service_restart_for_mcp.md)).

### Fallback When slang-mcp Is Down

When slang-mcp returns "No such tool available" AND `gh` fails with an invalid `GH_TOKEN`, use the unauthenticated public GitHub REST API with plain `curl`: `curl -s https://api.github.com/repos/shader-slang/slang/issues/<n>`, `curl -sG https://api.github.com/search/issues ...`. Limits: 60 core req/hr + 60 search req/hr. GraphQL is blocked (limit 0), so GitHub Discussions cannot be fetched this way. Discord, Slack, and GitLab (nv-master) all require slang-mcp and are simply unavailable — state that explicitly in the report ([Daily-report fallback when slang-mcp server is down](../learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md)).

## Slangd LSP Probing

To confirm whether a Slang language-server fix clears a diagnostic bug (e.g. #11532, false errors when opening a module fragment), drive a REAL `slangd` over stdio — do NOT rely on slang-test's `LANG_SERVER` harness (it forces `-periodic-diagnostic-update false`, under which slangd never publishes diagnostics). A minimal LSP client that: initialize → initialized → textDocument/didOpen(the file) → read for ~5s → collect `textDocument/publishDiagnostics`, WILL see the errors within ~1-2s. Framing is LSP-standard `Content-Length: N\r\n\r\n<json>` ([Verify Slang LS (slangd) diagnostics with a manual stdio LSP probe, not slang-test](../learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md), [Verify language-server-only diagnostic fixes with a real-slangd LSP stdio probe](../learnings/1781118241659-verify-language-server-only-diagnostic-fixes-with-.md)).

A reusable hardened probe lives at `/workspace/agent/wt-slang-11532/expt-logs/probe_slangd.py`. Always run a CONTROL arm (unpatched build) first to prove the probe + repro reproduce the bug before trusting a "fixed" result. `slang-unit-test` cannot link `Workspace`/`getOrLoadModule` symbols (non-`SLANG_API`, `-fvisibility=hidden`) ([Verify Slang LS (slangd) diagnostics with a manual stdio LSP probe, not slang-test](../learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md)).

## OneCLI Gateway: Injection Is PATH-SCOPED

The OneCLI gateway injects credentials **per-path**, and that scoping is the rule to internalize: on a shader-slang-scoped agent, `api.github.com/repos/shader-slang/*` returns **200** while `api.github.com/repos/microsoft/*` — any other org — returns **401 Bad Credentials**. Keeping the proxy env intact is **necessary but not sufficient**; the credential is present and healthy, it simply has no rule for the foreign path. So a 401/403 here is not evidence the token is broken, the object is missing, or the vault needs an operator (contrast the Discord all-channel 401 above, which *is* a token outage — the discriminator is whether an in-scope path still returns 200).

**The real defect is how the failure presents.** `curl -sf` suppresses the error body on HTTP failure, so a 401 arrives as **empty stdout, byte-identical to a legitimate "this object does not exist upstream."** Measured 2026-08-06 while root-causing a submodule-pin CI failure: three consecutive `curl -sf .../microsoft/mimalloc...` calls returned nothing, and the tempting conclusion — *"the pinned commit was force-pushed away upstream"* — was a claim the data did not support at all. Always run a **positive control** before reading empty as absence, and drop `-f` so the code is visible:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "User-Agent: curl/8.0" \
  "https://api.github.com/repos/microsoft/mimalloc"      # -> 401  (out of scope)
curl -s -o /dev/null -w '%{http_code}\n' -H "User-Agent: curl/8.0" \
  "https://api.github.com/repos/shader-slang/slang"      # -> 200  (control)
```

**The workaround is the git wire protocol, which is not path-gated the way the REST API is.** `git ls-remote --heads/--tags/--symref <url>` and a `--filter=blob:none` scratch clone both succeed against foreign orgs over the same proxy — enough for ref existence, default-branch resolution, and `git merge-base --is-ancestor` reachability tests. Also known-403 on this scope: `/repos/{o}/{r}/branches/{b}/protection`, so "is this check required?" must be answered from merge evidence rather than the required-contexts list. And never `unset HTTP_PROXY` to "fix" a 403 — that strips the injected token entirely and collapses the GitHub rate limit from 6000/hr to 60/hr ([OneCLI gateway injection is path-scoped; `curl -sf` hides the 401 as empty output](../learnings/1785992213588-onecli-gateway-injection-is-path-scoped-cross-org-.md)).

## GitHub GraphQL / ProjectsV2 Access

ProjectsV2 (org project boards) require a per-project access grant under the project's settings, separate from org-level Projects permission. The nv-slang-bot App install may have org Projects R/W yet still 403 on a specific board because it lacks the per-project grant. On the dev instance this was worked around with a human PAT path-routed to `/graphql`; prod has no such PAT, so ProjectsV2 writes are generally not available to prod coworkers. The OneCLI path quirk is the same path-scoping mechanism as above, at pattern granularity: `/graphql*` won't match the bare `/graphql` — use the literal ([GitHub GraphQL / ProjectsV2 access needs a per-project grant (often unavailable to the bot)](../learnings/legoop-project_graphql_path_routing.md)).


## Discord MCP 401 + Send-Timeout = Global Gateway Credential Failure, Not Cold-Start (2026-07-22 fold)

On the daily #slang-committers PR-report job (or any Discord MCP use), if `discord_send_message` returns `"Discord client initialization timed out"` AND `discord_read_messages` returns `Discord API error 401: Unauthorized`, this is a GLOBAL Discord bot-token credential failure in the OneCLI vault, not a per-container cold-start. Distinguish: a cold-start timeout is transient (a retry within a minute succeeds; reads still work), while a credential failure shows `401 Unauthorized` on reads and is reproducible across sessions/containers. What to do: don't keep retrying (2-3 attempts confirms the pattern — no agent can fix it, the operator must re-auth the token); preserve the generated report body to `/workspace/agent/<name>-UNPOSTED.md`, attach it to parent via `send_file`, and report `blocked` with the exact error strings + attempt counts; the scheduled job self-heals on the next fire once the credential is restored — never post a partial report. (`pr_report.py` exit codes: 10 = report due, 0 = quiet day, else = transient; chunk the body at `- **` assignee boundaries ≤1900 chars) ([Discord MCP 401 + send-timeout = global gateway credential failure, not cold-start](../learnings/1784696975060-discord-mcp-401-send-timeout-global-gateway-creden.md)).

---
## Discord MCP 401 On Every Channel = Token Outage, Not Transient (2026-07-23 fold)

When `mcp__slang-mcp__discord_read_messages` returns `Discord API error 401` on **every** channel (retried), it is a bot-token/auth outage requiring an operator token refresh — not a transient blip, a single-channel 403, or low-traffic empty results. One confirming retry is enough; report it as an infra outage in the daily report's Community section and Action Items, and proceed with the unaffected GitHub/CI/DeepWiki steps ([Discord MCP 401 across all channels = token outage, not transient](../learnings/1784708358394-discord-mcp-401-across-all-channels-token-outage-n.md)).

---
## `github_search_issues` Degraded — Empty For Every Query, Including `is:merged` (2026-07-26 fold)

An extended outage of the `mcp__slang-mcp__github_search_issues` tool: it returned `{items: [], total_count: 0}` for **every** query — trivially-matching ones (`repo:shader-slang/slang is:issue`) and merge windows of 1/2/6/25 days alike — while live issues and merges demonstrably existed. Confirmed independently by Main after slang-discord-support flagged it. The connection/auth is healthy; it's the **search endpoint specifically** — `github_list_issues`, `github_get_issue`, and `github_get_pull_request` all work fine. Two concrete casualties and their fixes: (1) **Duplicate-issue detection** — do NOT read an empty search result as "no existing issue," which risks the fleet filing dupes; fall back to `github_list_issues(state=ALL)` + client-side title/label filter, or `gh search issues`/`gh issue list --search` (a different search path) ([slang-mcp github_search_issues returning empty — use list+filter](../learnings/1785073457026-slang-mcp-github-search-issues-returning-empty-use.md)). (2) **Merge/queue-health checks** — `is:pr is:merged merged:>=<date>` returning zero nearly triggered a false "queue frozen/dead" escalation; the REST commits API showed the merges landing. Determine merge state via REST instead: per-PR `curl .../pulls/<N>` reading `.merged`/`.state`/`.draft`, and recent activity via `.../commits?sha=master` counting `(#NNNN)` first-line messages ([github_search_issues is:merged returns zero — verify merges via REST commits/pulls API](../learnings/1785053957653-github-search-issues-is-merged-returns-zero-verify.md)). This extends the earlier "slang-mcp github_search_issues date qualifiers return empty" note from a date-qualifier quirk to a total search-endpoint degradation — treat an empty `github_search_issues` as non-signal until the tool recovers.

**Source learnings (25):**
- [OneCLI gateway injection is PATH-SCOPED — cross-org GitHub reads 401 and `curl -sf` hides it as empty output](../learnings/1785992213588-onecli-gateway-injection-is-path-scoped-cross-org-.md) — an intact proxy env is not sufficient scope; positive-control every read, and use `git ls-remote` for foreign orgs.
- [slang-mcp github_search_issues degraded — empty for ALL queries; use github_list_issues+filter or gh search for dup-detection](../learnings/1785073457026-slang-mcp-github-search-issues-returning-empty-use.md)
- [github_search_issues is:merged returns zero even when merges happened — verify merge/queue state via REST commits/pulls API, don't escalate a phantom outage](../learnings/1785053957653-github-search-issues-is-merged-returns-zero-verify.md)
- [codex-critique gate: open the PR before claiming it in OUTPUT_REVIEW](../learnings/1780325263478-codex-critique-gate-open-the-pr-before-claiming-it.md)
- [critique-gate stage detector keys on first stage-keyword](../learnings/1780971403094-critique-gate-stage-detector-keys-on-the-first-sta.md)
- [Verify slangd diagnostics with a manual stdio LSP probe](../learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md)
- [Verify language-server-only diagnostic fixes with real slangd probe](../learnings/1781118241659-verify-language-server-only-diagnostic-fixes-with-.md)
- [codex-critique: /workspace not /tmp, gate denies whole bash block](../learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md)
- [critique-gate: STAGE marker in codex PROMPT + Verdict block in RESPONSE](../learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md)
- [codex-critique gate: start a fresh codex session per deliverable](../learnings/1781386154716-codex-critique-gate-start-a-fresh-codex-session-pe.md)
- [critique-gate OUTPUT_REVIEW is sticky within a reused codex thread](../learnings/1781386183865-critique-gate-output-review-is-sticky-within-a-reu.md)
- [critique-gate records verdict from fresh codex calls, not codex-reply](../learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md)
- [codex-critique gate records stage verdicts only from fresh staged call](../learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md)
- [codex critique-gate tracks FRESH-call verdicts, not codex-reply](../learnings/1782439747524-codex-critique-gate-tracks-fresh-call-verdicts-not.md)
- [Reviewer gate: require full-suite CI for broad-blast-radius changes](../learnings/1782454067582-reviewer-gate-the-verdict-on-full-suite-ci-for-bro.md)
- [slang-mcp github_search_issues date qualifiers return empty](../learnings/1780906273275-slang-mcp-github-search-issues-date-qualifiers-ret.md)
- [Daily-report fallback when slang-mcp server is down](../learnings/1782288946942-daily-report-fallback-when-slang-mcp-server-is-dow.md)
- [Restart only the specific MCP subprocess, not the whole service](../learnings/legoop-feedback_no_service_restart_for_mcp.md)
- [GitHub GraphQL / ProjectsV2 access needs per-project grant](../learnings/legoop-project_graphql_path_routing.md)
- [API budget cap blocks LLM subagent dispatch](../learnings/1781539485742-api-budget-cap-blocks-llm-subagent-dispatch-not-di.md)
- [When CI regresses but git diff is empty, suspect the toolchain](../learnings/1780623682428-when-ci-regresses-but-git-diff-in-the-bisect-range.md)
- [CI failure reports: surface unpinned toolchain installs](../learnings/1780623760932-ci-failure-reports-surface-unpinned-toolchain-inst.md)
- [Slang CI exposed to unpinned toolchain drift](../learnings/1781055257855-slang-ci-exposed-to-unpinned-toolchain-drift.md)
- [Discord MCP 401 + send-timeout = global gateway credential failure (operator re-auth), not cold-start; preserve report to UNPOSTED.md](../learnings/1784696975060-discord-mcp-401-send-timeout-global-gateway-creden.md)
- [Discord MCP 401 on every channel (retried) = bot-token outage needing an operator refresh; distinct from a single-channel 403 or empty low-traffic results](../learnings/1784708358394-discord-mcp-401-across-all-channels-token-outage-n.md)
_Catalog: [[wiki/index.md]]_
