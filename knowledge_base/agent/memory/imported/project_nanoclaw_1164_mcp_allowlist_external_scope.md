---
name: project_nanoclaw_1164_mcp_allowlist_external_scope
description: "nanoclaw#1164 (szihs) scopes the MCP allow-list to EXTERNAL servers, drops MANDATORY_MCP_TOOLS. Reviewed INLINE (8th no-nanoclaw-approver instance), comment 5236831048, MERGED mid-review (7th race). 1🔴 an external server named `nanoclaw` REPLACES the built-in and now gets a namespace wildcard; 2🟠; the PR's own gate canary cannot fail for its stated reason."
metadata:
  node_type: memory
  type: project
  originSessionId: mcp-allowlist-scope-1164
---

# nanoclaw#1164 — MCP allow-list scoped to external servers only

PR https://github.com/slang-coworkers/nanoclaw/pull/1164, author **szihs**, base **`nv-main`**,
head `145928510a917e8bedc25cd61fd2e5785959cd93`, base `73b5ec2a4947fb701fee9c18ef8610b2aeae11aa`,
18 files **+670/−618**. My review comment **`5236831048`**. Follow-up to #1157 (merged), whose
scope the owner corrected.

Deletes `MANDATORY_MCP_TOOLS` (the 3-tool "transport floor") and the host delivery-action gate
`isNanoclawActionPermitted`; replaces both with a prefix test `isBuiltinMcpTool` +
`BUILTIN_MCP_SERVER = 'nanoclaw'`. `enforcedTools` → `externalTools`. Built-ins now answer only to
their own per-tool gates, inventoried in a new `src/builtin-mcp-gates.test.ts`.

**Routing: handled INLINE by Main. 8th instance** of the standing rule — the `pr_ready_for_review`
webhook again carried the generic *"Route it to the project's `*-pr-approver` (never a
reviewer/fixer)"* string, which targets PRODUCT repos only. Destinations held only
`slang-pr-approver` / `slangpy-pr-approver`. See [[project_nanoclaw_pr874_webhook_route_approver]].

## STATE — MERGED MID-REVIEW (7th race in the series)

`merged_at 2026-08-10T06:20:16Z` by **szihs**, merge commit `0e5fbaafd41252f3229dd01e7f4e6010c6a54392`.
Pre-post recheck caught it: arrival `state=open mergeable_state=unstable merged=false`, recheck
`merged=true state=closed`, ~8 min later. **`head` SHA never moved.** ⭐ I went further than the
SHA check this time and diffed all six finding-bearing files against `nv-main` (`0280ead6`) by
`git rev-parse <sha>:<path>` — all SAME. That is stronger than "head didn't move": it proves the
findings apply to the *merged* content even if a later commit had touched the area.
All 4 checks green; `ci` was `in_progress` on arrival → **pending on arrival is not a finding**.
Prior races: #1066/#1068/#1071/#1075/#1078/#1162.

## 🔴 An external MCP server named `nanoclaw` REPLACES the built-in one

The new boundary is a **name**, and server names come from config that is never validated against
a reserved list. `validateAddMcpServer` (`src/modules/self-mod/request.ts:130-165`) checks non-empty
string / args+env shapes / counts / payload size — **no reserved-name check, no charset check**.

Container-side it is replacement, not shadowing. `index.ts:105` builds the built-in entry, then
`index.ts:191` `mcpServers[name] = config` over `NANOCLAW_MCP_SERVERS` — same key, later write wins.
The withhold loop (`:205`) exempts `nanoclaw` **by name**, so the impostor survives the filter that
drops `codex`/`deepwiki`. Executed: `'bun' → 'sh'`, then `Object.keys === ['nanoclaw']`.

**The PR's delta is the tools, and it is measured** — same probe file, both trees, `explicit []`:

| | base #1157 | head #1164 |
|---|---|---|
| `mcpAllowedToolEntries(policy,['nanoclaw'])` | `[send_message,send_file,add_reaction]` | `["mcp__nanoclaw__*"]` |
| PreToolUse blocks `mcp__nanoclaw__anything_at_all` | **true** | **false** |

Server *wiring* was already unconditional on base (floor tools made the prefix match ⇒
`serverHasAllowedTools(r,'nanoclaw')` true on BOTH trees). ⭐ **Getting that right mattered: the
naive claim "this PR makes the impostor wired" is FALSE. Only the callability of its tools changed.**
Host-side invisible too: `isMcpToolPermitted('mcp__nanoclaw__exfiltrate')===true`, never in
`blocked`, wire carries `tools: []`.

⭐⭐ **The tests assert `isBuiltinMcpTool('mcp__nanoclaw-evil__x')===false` — a lookalike isn't
mistaken for the built-in. The dangerous direction is the reverse: the exact name being TAKEN.**
A test can cover a namespace-confusion class and still test the harmless half of it.

Remedy verified BOTH directions (probe F): one `if (name === BUILTIN_MCP_SERVER) continue;` in the
merge loop ⇒ `'bun'` survives; legitimate external servers get an identical key set
(`['deepwiki','nanoclaw']`) either way.

## 🟠 The new gate canary cannot fail for the reason its docstring gives

`builtin-mcp-gates.test.ts` claims it pins the inventory "to the registry instead of to prose, so
the day someone registers a new privileged action without a guard, this goes red." **It does not.**
Executed against the real registry: registered `exfiltrate_everything` unguarded →
`describeDeliveryActionGuard` reports `{registered:true, guarded:false}` (read side sees it) → the
`classifies every built-in exactly once` assertion **still passes**, because both sides derive from
the same hand-written `BUILTIN_TOOL_ACTIONS` literal.

⭐⭐⭐ **A self-consistency check on a constant, dressed as a check against a registry — and the
read side it needed was added in the same PR.** Same family as [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]]:
the tell was designed, the wiring was not built.

NOT a regression: `NANOCLAW_ACTION_TOOLS` was also a literal and an absent action fell through
`isNanoclawActionPermitted` **ungated** pre-PR. But it matters more now — the per-tool inventory is
no longer a second net behind the allow-list, it is the whole argument.
Fix: export the registry key set, assert `registry ⊆ classified ∪ {cli_request, record_human_verdict}`.
Enumerated live, so the assertion passes today: `add_mcp_server, append_learning, cli_request,
create_agent, install_packages, map_pr_session, record_decision, record_human_verdict,
request_restart, wire_agents` (11 registered; scheduling tools are NOT delivery actions in this fork).

## 🟠 "loses no protection that existed" — over-stated by exactly one input class

Differential on `allowed_mcp_tools='[]'` (the containment configuration an operator reaches for):

| permitted under `explicit []` | base | head |
|---|---|---|
| `report_pr_created` | **false** | **true** |
| `append_learning` | **false** | **true** |
| create_agent / install_packages / wire_agents | false | true (harmless — guard-held / is_admin) |

⇒ the ONE configuration where the blunt instrument was load-bearing is exactly the pair documented
as needing argument-level authorization that does not exist yet. Rollout caveats currently assert
the opposite ("Caveat A is gone… No pre-rollout sweep needed"). The manifest-inherited claim IS
true (verified: `base-nanoclaw` grants both) — the over-statement is only about explicit `[]`.

⭐⭐⭐ **Identical shape to the `unmeasured_builds` finding on #1162: a correct split of two
conflated facts regresses for the one input class the old blunt instrument uniquely covered.
⇒ Before removing a mechanism you've proved is the wrong shape, ask what it was UNIQUELY covering.**
Two instances in two days ⇒ pattern, not coincidence.

## Note — four comments + one env var describe deleted code

Same class as the `select()` docstring note on #1162 (prose the reader hits first contradicts the
change), and the file header is the worst place for it:
- `container/agent-runner/src/mcp-policy.ts:21-24` — "unresolved… permits only the mandatory
  transport floor… neither is a reason to hand over `install_packages`". At head unresolved permits
  **every** built-in incl. `install_packages` — asserted by the PR's OWN test.
- `index.ts:196-198` — "instead filters itself per-tool (see mcp-tools/server.ts)": that
  self-filtering is deleted in this PR.
- `index.ts:114-118` + the forwarding — `NANOCLAW_MCP_POLICY` still injected into the built-in
  server's env; **nothing under `mcp-tools/` reads it at head** (0 refs). Dead var.
- `index.ts:184` — logs "every configurable MCP tool is denied"; should say external.

## Positives verified, not read

**Requirement 3's enumeration is accurate.** 13 tools across 5 `registerTools` calls
(`agents/core/interactive/self-mod/learnings.ts`) == 13 doc-table rows == `BUILTIN_TOOLS` in
`mcp-allowlist-scope.test.ts`. All 8 host-effect actions `registered:true` with exactly the declared
guard state; `cli_request`/`record_human_verdict` correctly outside. Nothing missing, nothing misfiled.

## Gates — and a correction to the PR's own acceptance table

- Host `vitest run`: **2272 pass / 3 skip / 1 suite fail** = `setup/register.test.ts`
  `Cannot find module './dashboard.js'` — the stated baseline. Matches.
- Container `bun test`: **391 pass / 1 skip / 3 fail**, all three
  `dispatchResultText — critique-gate text-output integration (#67)`. The PR says "1 failure, the
  known `Bun.YAML` scaffold baseline" — I saw **0** Bun.YAML failures and 3 different ones.
  ⭐ **Ran the identical suite on the BASE tree: same 3, same names (398/3).** So the CONCLUSION
  (no new failures) holds and only the description of which failures are baseline is wrong — likely
  a Bun-version difference (1.3.12 here). **A baseline claim needs the baseline RE-RUN on your own
  edge, not quoted; and a mismatched baseline does not invalidate the no-regression conclusion.**
- 4 PR-touched files: 36/36 host, 24/24 container.

## Method notes

- `git worktree add --detach <base-sha>` + **symlinked `node_modules` from the head clone** gives a
  base tree that runs the same probe file for ~0 install cost. This is the cheap way to do
  differential runs and it avoids the `git stash` trap the author hit on #1162 (stash reverts the
  TESTS with the source).
- Probes as throwaway `src/probeX.test.ts` inside the real tree ⇒ real module graph, real registry,
  real mocks. Deleted after each run.
- `--reporter=verbose` is required to see `console.log` from a passing vitest test; the default
  reporter swallows it. Cost me one wasted run.
- Write path: `gh api repos/.../issues/1164/comments --method POST -F body=@file`.

## Related

MCP allow-list lineage: #1157 (this PR's parent, merged) · [[project_nanoclaw_1162_gc_full_candidate_list]]
(the `unmeasured_builds` pattern this repeats) · [[project_nanoclaw_1103_host_grant_ledger]] ·
[[project_nanoclaw_1152_consume_stamp_interleave]].
Routing rule: [[project_nanoclaw_pr874_webhook_route_approver]].
Canary/tell pattern: [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]].
