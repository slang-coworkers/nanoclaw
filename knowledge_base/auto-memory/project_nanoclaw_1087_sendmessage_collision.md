---
name: project_nanoclaw_1087_sendmessage_collision
description: "slang-coworkers/nanoclaw#1087 nv-coworkers upstream sync — SendMessage built-in disallowed; reviewed inline, guard verified by negative control, merged mid-review by the nightly sync task"
metadata:
  node_type: memory
  type: project
  originSessionId: pr1087-webhook
---

**slang-coworkers/nanoclaw#1087** — `Sync nv-coworkers with upstream/main`, `sync/upstream-nv-coworkers` → `nv-coworkers`, bot-authored (`nv-slang-bot[bot]`, nightly `sync-upstream.sh`). 3 files, +42/−3. `pr_ready_for_review` webhook (reason `opened`) 2026-08-05.

**Handled INLINE by Main — NOT routed**, per the standing rule ([[project_nanoclaw_pr874_webhook_route_approver]]): no nanoclaw `*-pr-approver` is wired, and slang/slangpy approvers are repo-scoped ⇒ would `ABSTAIN_POLICY`. The webhook's generic task string ("Route it to the project's `*-pr-approver`") is STALE for this repo; ~21st instance.

**Content:** upstream `81b18a9f` (via upstream merge `358f1a81`, PR nanocoai#3187 by dim0627) moves `'SendMessage'` from `TOOL_ALLOWLIST` → `SDK_DISALLOWED_TOOLS`, exports both lists, and adds `claude.tool-collisions.test.ts` (+32). Motivation: the Claude Code built-in `SendMessage` addresses the SDK's own *in-session subagents*, so an agent that had just run `create_agent` reached for it by name and got `No agent named 'x' is currently addressable` — which reads as "the group was never provisioned" while `mcp__nanoclaw__send_message` (the real a2a path) was never called. Plus a CHANGELOG entry.

**Inline verdict: clean, nothing to flag.** Coherent with the fork's own a2a model — `grep -rE '\bSendMessage\b'` over the fork tree and `search/code` (total_count 0) found **no** dependency on the built-in outside the two files this PR touches, so removing it from the allowlist breaks nothing. `TeamCreate`/`TeamDelete`/`Task`/`TaskOutput`/`TaskStop` remain allowlisted — subagent *spawning* is unaffected; only the misleading *messaging* built-in is blocked.

**GUARD VERIFIED LIVE — not just "test passes".** Ran it: 3 pass / 5 expects. Then the **negative control**: reverting the change (SendMessage back in `TOOL_ALLOWLIST`, out of `SDK_DISALLOWED_TOOLS`) makes the guard test FAIL (4 fail), so it is not inert. Consumption confirmed **in the PR-head artifact itself** (`claude_head.ts`, not just my clone): `disallowedTools: SDK_DISALLOWED_TOOLS` at the SDK call site (:549) **and** a PreToolUse hook `if (SDK_DISALLOWED_TOOLS.includes(toolName)) → decision:'block'` (:239) — belt-and-braces, so the block holds even if the SDK filter is bypassed.

**Regression sweep:** full `bun test` = **345 pass / 1 skip / 3 fail**. The 3 are the known pre-existing `dispatchResultText — critique-gate` trio (same 3 named in [[project_nanoclaw_pr873_sync_nvmain]]). **Proven pre-existing by measurement, not assumption:** with the change reverted the suite is **4 fail** (same trio + the guard correctly failing); with it applied, **3 fail**. So the diff removes a failure and adds none.
⚠️ `bun install --frozen-lockfile` was required first — the initial run's "1 fail / 1 error" was `Cannot find module '@anthropic-ai/claude-agent-sdk'`, a **missing-deps artifact, NOT a test failure**. Don't read that as a red suite.

**MEASUREMENT CAVEAT — read before reusing these numbers.** I ran the suite in my local clone at `4c41224f`, which is **`nv-main`, NOT this PR's branch**. `diff` of the two `claude.ts` files shows the clone carries a large body of nv-fork-only code absent from the PR head (`parseAllowedMcpTools`, `computeBlockedTools`, `detectIssueClose` issue-close backstop, `resolveEnvInherit`, usage telemetry, `[1m]` auto-compact window, `fallbackModel`). **The test file is byte-identical** (`diff` vs the merge commit → IDENTICAL, 1448 B) and the `SendMessage` hunks are identical in substance (line offsets differ only: disallowed @94 vs @95, allowlist @108 vs @113). ⇒ the guard result transfers; a *whole-suite* pass/fail count from this clone is about nv-main's tree, not the PR branch's.

**CI:** only `label` ✓ (5s). No `ci` gate — `ci.yml` fires only on PRs into `main`, per [[feedback_nv_coworkers_automerge]]. `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`.

🔴**MERGED MID-REVIEW at 2026-08-05T14:28:29Z** by `nv-slang-bot` — the nightly sync task's own REST auto-merge (standing authority for `nv-coworkers`), merge commit `7568f80a`, head `96bab118`. I discovered this only because `gh api .../git/ref/heads/sync/upstream-nv-coworkers` returned **404** (repo auto-deletes head branches on merge) while I was fetching the file to diff. ⭐**A 404 on a head ref mid-review is a MERGE signal, not a fetch error** — re-query `state`/`mergedAt` before concluding anything about the branch. ⚠️Also: `gh pr view --json merged` is **not a valid field** (use `state` + `mergedAt`); the error dumps the whole field list.

⭐**Fetch the artifact by COMMIT SHA, not by branch name, when reviewing an auto-merging repo** — my first fetch used `?ref=sync/upstream-nv-coworkers` and succeeded; the second, minutes later, 404'd because the branch had been deleted underneath me. Pinning `?ref=<sha>` (or the merge commit) is immune.

**No GitHub comment posted** — merged, clean, self-verified bot sync with nothing substantive to add (comment hygiene; same call as #873/#1086). **On redelivery: state is MERGED, do NOT route to a product approver, do NOT re-review.**
