---
name: project_nanoclaw_1168_inherited_scope_discovery
description: "nanoclaw#1168 (szihs) mcp allow-list explicit-only. Reviewed PRE-MERGE, comment 5237302393. 1🔴 REGRESSION: `inherited` now resolves to `inventory ?? []`, and spawn scopes the proxy token from externalTools ⇒ a crashed MCP server silently narrows a group while restricts=false/blocked=[]/cfgErr=null on every operator surface. 1🟠 CLI `restricted` computed from state not restricts ⇒ lies for ADMIN_MCP_TOOLS. My #1164 🔴 is CLOSED."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4261c307-1e02-4a9c-8d81-eb0b70a3ce71
---

# nanoclaw#1168 — mcp allow-list: only an explicit `ncl` list may change a group's scope

Author szihs, base `nv-main`, head `24627f6b`, +599/-366 / 14 files. Reviewed **PRE-MERGE**
(second in this series after #1167 — the merge-race streak broke). CI green (check/ci/guard/label).
Comment `5237302393`. ~33rd instance of the **no nanoclaw approver exists ⇒ Main reviews inline**
rule (destinations carry only `slang-pr-approver` / `slangpy-pr-approver`).

## My #1164 finding is CLOSED

An external server named `nanoclaw` can no longer take the built-in's namespace wildcard:
`serverHasAllowedTools` short-circuits on `serverName === BUILTIN_MCP_SERVER` before any prefix
compare, and both `parseMcpPolicy` and the host resolver **drop** built-in-prefixed entries.

## 🔴 The headline — a regression I first misfiled as pre-existing

`container-runner.ts:494` `registerContainerToken(agentGroup.folder, mcpPolicy.externalTools)` is
**byte-identical to pre-PR** (`:503` before). That is why my first read called it pre-existing.
**Change #1 replaced the line's INPUT.** Differential run against merge-base `0280ead6`:

```
PRE-PR full-inventory : state=inherited externalTools=["mcp__slang-mcp__github_get_issue"]  (MANIFEST)
PRE-PR zero-inventory : state=inherited externalTools=["mcp__slang-mcp__github_get_issue"]  (stable!)
HEAD   empty {}       : state=inherited externalTools=[]  restricts=false  cfgErr=null
```

Pre-PR `inherited` = the manifest, which does not move when discovery fails. At head it is
`inventory ?? []`, so the token scope tracks proxy state. Proxy rejects anything absent from
`allowedTools` at `mcp-auth-proxy.ts:455` → 403.

**Reachability is a single crashed server, not a dead proxy:** `mcp-registry.ts:248/:287` call
`clearDiscoveredTools(def.name)` from the `exit` handler; `stopServer` `:415` too; `index.ts:248`
swallows a startup discovery failure with `log.warn`. Executed — deepwiki discovered, slang-mcp
failed: `restricts=false`, `blocked=[]`, `cfgErr=null`, policy permits the tool, **token does not**.

Two aggravators: (1) **durable past recovery** — `updateContainerTokenScope` is called from exactly
ONE place (`cli/resources/groups.ts:210`, the `mcp-tools set` handler); `restartServer` re-discovers
but never re-scopes tokens, so a container spawned in the gap keeps the narrowed scope for life.
(2) **invisible** — the agent gets a proxy 403, not the PreToolUse "configuration boundary, do not
retry" message, so it retries.

**The PR's own no-op test cannot see it:** `expectDeniesNothing` probes `isMcpToolPermitted` /
`serverHasAllowedTools` / `blocked` / `restricts` / `toMcpPolicyWire().restrict` — five surfaces,
**none of them `externalTools`**, the one field spawn consumes. Its "proxy is down" case
(`:112`) passes while the token scope is empty.

## 🟠 `get` reports `restricted: false` for a group it is actively restricting

`cli/resources/groups.ts:129` changed `state !== 'unrestricted'` → `state === 'explicit'`.
`ADMIN_MCP_TOOLS` resolves to **`state:'inherited'` + `restricts:true`** (`mcp-allowlist.ts:274`) —
the exact divergence the PR added `restricts` for. Executed: CLI @head `false`, truth `true`,
pre-PR expression `true`. `blocked` in the same payload contradicts it. Fix: `restricted: resolved.restricts`.
`ADMIN_MCP_TOOLS` is unset on my edge; the expression regression is real regardless.

## 🟡 Stale artefacts of the removed `unresolved` state

`container-runner.ts:1743` comment says a missing var means "deny all" (PR inverted it) ·
`mcp-allowlist.ts:356-360` `parseAllowlistFlag` doc still says `inherit` restricts to the manifest ·
`cli/resources/groups.ts:168` `set` help repeats it (the `get` help WAS updated) ·
`claude.mcp-policy.test.ts:10` header asserts the pre-PR invariant.

## Not verified — stated as such

The body's "11/11 fail against merged nv-main" acceptance claim: the no-op test **fails to load** on
my checkout (`Cannot find package 'js-yaml'` via `claude-composer/registry.ts`; `js-yaml` absent
from my `node_modules`). Import error ≠ 11 behavioural failures. Recorded as *not verified*, not
disputed — the claim's shape is right since the base resolver consults the manifest.

## Method notes

`git worktree add` at both PR head and merge-base, symlink the shared `node_modules`, then write
throwaway `verify-*.test.ts` files that **re-implement the consumer's expression** (the
`registerContainerToken` scoping and the `:455` check) rather than trusting the reading. That is
what produced every figure above.

See [[feedback_an_unchanged_call_site_can_still_be_the_regression]].
