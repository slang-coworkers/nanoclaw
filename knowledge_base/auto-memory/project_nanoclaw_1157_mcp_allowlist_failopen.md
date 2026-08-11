---
name: project_nanoclaw_1157_mcp_allowlist_failopen
description: "nanoclaw#1157 (szihs, F03 P1-a/P1-b mcp allow-list fail-open + group-wide revoke) MERGED mid-review 05:04Z; reviewed post-merge, 22/23 blobs == nv-main BY HASH. 6 🟡; the load-bearing one is a CROSS-PR doc conflict: #1157 ships an rsync --delete refresh that #1161 (merged 50min later) names as destroying self-customize + /add-opencode files."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1157
---

**slang-coworkers/nanoclaw#1157** — `mcp allow-list: close the empty-list fail-open and revoke group-wide (F03 P1-a/P1-b)`,
author **szihs**, base `nv-main`, 23 files +1998/−67. Comment **5236572969**.
**ROUTING: handled INLINE by Main** — platform-infra fork, ~30th+ instance ([[project_nanoclaw_pr874_webhook_route_approver]]).
Direct follow-up to [[project_nanoclaw_1116_one_allowlist_resolver]] (my #1082 recommendation).

## MERGE RACE — and the race is what produced the best finding

Merged `05:04:24Z` (szihs, `01e8f210`), ~26 min after the `opened` webhook, while I was measuring.
**22 of 23 blobs byte-identical to `nv-main` tip `73b5ec2a`** ⇒ findings live. The 1 exception (`CLAUDE.md`)
diverged only because **#1161 rewrote a different row 50 min later**; #1157's own index entry survives at `CLAUDE.md:304`.

⭐⭐⭐**THE FINDING NO SINGLE PR'S REVIEW COULD CATCH: two commits 50 min apart, contradicting each other on `nv-main` right now.**
#1157 ships `docs/mcp-allowlist.md:128-131` telling operators `rsync -a --delete container/agent-runner/src/ → each group's copy`.
#1161 (`da9f4a48`, `05:54:56Z`) exists to *prevent* exactly that: *"A blind cpSync would destroy both [self-customize edits,
/add-opencode files]. Trading silent inertness for silent data loss is not progress."* `--delete` is **strictly worse** than
cpSync — it removes copy-only files = #1161's `extra` class (`agent-runner-staleness.ts:179`, reported never written).
⇒ **Because I reviewed post-merge, I could see the successor. A pre-merge review of #1157 alone cannot contain this finding.**
Safe path #1161 added: `pnpm run check:runner-staleness [-- --refresh]` (writes only `stale`/`missing`).

## Both P1s genuinely closed — REVERT DRILL, not reading

Restored every non-test file to base `8d108b2f`, kept new tests:

| test | pre-fix |
|---|---|
| `claude.mcp-policy.test.ts` | **11 fail / 1 pass** |
| `server.mcp-policy.test.ts` | **fails to load** (`Cannot find module '../mcp-policy.js'`) |
| `mcp-tools-set-revocation.test.ts` | **5 fail / 0 pass** |

At head: 27/27 new host tests (4 files), 26/26 new container (3 files), 118 pass/3 skip on 6 adjacent existing suites.

✅**ARMED THE DRIFT GATE rather than quoting its green:** added `install_packages` to the CONTAINER copy of
`MANDATORY_MCP_TOOLS` only → `mcp-allowlist-enforcement.test.ts` went `1 failed | 13 passed` **and named the mismatch**.

## The 6 🟡 (all latent; none argued against the merge)

1. **Layer 2 is a closed-set lookup that DEFAULTS TO ALLOW.** `delivery.ts:689-690` — `const tool = MAP[action]; if (!tool) return true;`
   **Constructed it:** registered a hypothetical `exfiltrate_secrets` the way all 8 real ones are registered, group at `'[]'`
   → **it ran**; control `install_packages` → denied. Censused all 10 container-written actions: 8/8 privileged ones mapped
   (`cli_request`, `record_human_verdict` correctly exempt) ⇒ blast radius nil TODAY. Flagged because the PR's thesis is
   "complete by construction" and this is the layer it calls "the important new one". Same shape as
   [[feedback_a_closed_set_allowlist_is_the_wrong_shape]]. Fix exists in-tree: `guard/conformance.test.ts` walks its registry.
2. **`ask_user_question`/`send_card` NOT host-denied by `[]`, and `docs/mcp-allowlist.md:46` says they are.** Both write
   `kind:'chat-sdk'` (`interactive.ts:103,166`) so they never reach `handleSystemAction` (`delivery.ts:273`). Denied only by
   layers 5/6 — which the PR itself calls not-a-trust-boundary and which are inert on unrefreshed groups.
3. **`src/mcp-policy-parity.test.ts` DOES NOT EXIST** — both copies of the floor point at it (`mcp-allowlist.ts:81`,
   `mcp-policy.ts:51`). Real test lives at `mcp-allowlist-enforcement.test.ts:167`. A pointer to a nonexistent enforcement
   file reads as coverage.
4. **Post-response queue is a MODULE GLOBAL; drain empties all of it.** Constructed both inversions: cross-request
   (`socket-server.ts:65` = `void handleFrame` per line, unserialized) and single-request (the `setTimeout(...,0)` fallback
   at `post-response.ts:43` fires on the next macrotask — **one `await` between handler-return and write inverts the order,
   while emitting the "a transport did not drain" warning**). Not load-bearing today (`denySelfTarget`), but the file's stated
   reason to exist is removing an invariant that "lives only in the interaction between two files" — it relocated it.
5. **`blocked: []` under an unreadable inventory reads as "nothing blocked".** Only `unrestricted`/admin-default degrade to
   `unresolved`; `explicit`/`inherited` keep state ⇒ measured `state=explicit blocked=[] configuration_error=absent` vs 2 tools
   when readable. Enforcement unaffected (default-deny, not inventory-derived); the OPERATOR SURFACE loses the distinction.
6. **Host layer 3 cannot reach `codex`** — hardcoded IN THE CONTAINER (`index.ts:120`); no `coworker-types.yaml` declares
   `mcpServers`, nothing host-side inserts it ⇒ never in `NANOCLAW_MCP_SERVERS`. Prose implies its env is withheld host-side.
   ⇒ codex revocation on a pre-existing group depends entirely on the runner refresh — which is (a) above.

## Verified as claimed / behaviour-change confirmed independently

Proxy fail-closed on empty scope (`mcp-auth-proxy.ts:455`, `-32600`) · token strips `mcp__nanoclaw__*` (`:57-58`) ·
`report_pr_created`→`map_pr_session` the one name mismatch, handled · `unresolved` reachable because `resolveTypeChain`
THROWS on unknown type (`resolve.ts:184-194`) · restart filter matches `restartAgentGroupContainers`'s own.
**Ran the real registry** for the author's own flagged behaviour change: `main` (`flat:true`) → **0** MCP tools,
`default` → **18** ⇒ non-admin `main` does resolve inherited-empty. A/B on `base-nanoclaw/SKILL.md` alone: `default` 17→18.

## ⛔ MY OWN INSTRUMENT DEFECT — caught by a control, would have published a false regression

⭐⭐⭐**`prettier` run on a file in `/tmp` does NOT pick up the repo's `.prettierrc` (`printWidth: 120`).** My first pass
compared base-vs-head by writing base to `/tmp/claude-base.ts` → **89 "deviations"** on base vs 3 at head, i.e. base looked
catastrophically unformatted. Re-run with both files INSIDE the repo: base **0**, head **3**. ⇒ the real finding is the
opposite direction and much smaller — `claude.ts` was prettier-clean on `nv-main` and the `createPreToolUseHook` wrapper left
its body at the old indentation. **A config-discovery tool measures the DIRECTORY, not the file you hand it.**
Also scoped the green: `prettier --check "src/**/*.ts"` IS the repo's gate (`package.json:19` + `.husky/pre-commit`);
**neither `ci.yml` nor `compose-check.yml` runs prettier at all** ⇒ nothing here is CI-blocking. `index.ts` 3→3 and
`CLAUDE.md` 14→14 are pre-existing (controls run).

Also: `allowedToolsForServer` (`mcp-policy.ts:132`) exported, referenced only by its own test — dead by the repo's own rule.

## Instrument notes

- KB clone's `node_modules` lacks `js-yaml` at top level (only `.pnpm/js-yaml@4.1.1/`); symlink it explicitly or every
  import of `claude-composer/registry.ts` dies. Same trap as #1116.
- `/workspace/extra/ephemeral` still **READ-ONLY** despite the name; `/tmp` + `/workspace/agent/tmp` writable.
- `git clone --no-hardlinks` from the KB clone can't fetch `nv-main` by name (it's `origin/nv-main` there) — create a local
  branch in the source clone first, then fetch that.

**RESUME** = szihs replies, or (a) gets its own PR. All 6 live on `nv-main` at `73b5ec2a`. No auto-merge involvement;
merge was the maintainer's. `src/mcp-policy-parity.test.ts` confirmed still absent at the tip.
