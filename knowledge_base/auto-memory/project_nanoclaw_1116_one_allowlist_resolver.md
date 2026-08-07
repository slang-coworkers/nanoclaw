---
name: project_nanoclaw_1116_one_allowlist_resolver
description: "nanoclaw#1116 mcp-allowlist single resolver (#1082 follow-up F03) — MERGED 6min, reviewed post-merge, 9/9 blobs == nv-main BY HASH; both my #1082 reds CLOSED; 1 residual 🟡: denySelfTarget misses cli_scope=global + omitted --id"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-pr-slang-coworkers/nanoclaw-1116
---

**slang-coworkers/nanoclaw#1116** — `fix(mcp-allowlist): one resolver for read, write and spawn (F03)`, author
**szihs**, base `nv-main`, 9 files +471/−65. **ROUTING: handled INLINE by Main — ~29th instance** of the
platform-infra-fork rule ([[project_nanoclaw_pr874_webhook_route_approver]]). Comment `5205757683`.

**MERGE RACE #8** — merged `13:36:11Z` (~6 min after webhook), reviewed post-merge. **All 9 changed blobs
byte-identical to `nv-main` BY HASH** ⇒ findings LIVE. ⭐The hash check is what converts "I reviewed a
stale head" from an assumption into a verified fact — one `git rev-parse HEAD:$f` vs `origin/nv-main:$f`
loop per file.

## This PR is szihs implementing MY #1082 recommendation — and it works

Both 🔴 from [[project_nanoclaw_1082_ncl_mcp_tools_verbs]] are genuinely dead. **Verified by RUNNING the
real resolver over a 10-cell matrix, not by reading the diff** (the #1082 lesson: every defect in this
series was in the operator surface and invisible to reading). `NULL`=inherited / `*`=unrestricted /
`[...]`=explicit are now distinct states; `explicit` wins for admin too (`is_admin` only decides what
`inherited` means). Legacy comma form now agrees across both readers. `"*"` alone = sentinel, `"*"` inside
a longer list = a tool name — correct.

## 🟡 THE RESIDUAL CELL — F04's guard has a hole at `cli_scope: 'global'`

`guard.ts:108` tests `args.id === actor.agentGroupId`. The auto-fill that makes an omitted `--id` equal the
caller's own group runs **ONLY** under `cli_scope:'group'` (`dispatch.ts:88-90`). At `'global'` nothing
fills `id` ⇒ `args.id === undefined` ⇒ deny skipped ⇒ `access:'approval'` MINTS THE CARD. Measured
end-to-end (mocked live grant so the replay actually executes): `approval-pending`, `requestApproval` 1×,
card reads `ncl self-target-cmd --tools []` with **no target shown**, approved replay ALLOWs, real handler
then throws `--id is required` (`groups.ts:154`), `updateAgentGroup` calls **0**.

⇒ **NOT an escalation — but exactly the defect F04 existed to remove, in the one scope its tests miss.**
The PR claims "No card is created, so no human is prompted for work that can never succeed." True at
`group`, false at `global`+omitted. Its 2 new guard tests cover `group`+auto-filled and
`global`+explicit-self-`--id`. ⭐⭐**The uncovered cell was predictable from #1082's own closing lesson
(enumerate the CASE MATRIX over axes already identified) — here the axis was `cli_scope`, and the author's
own two tests name both its values without crossing them with the omitted-`--id` case.**

⭐⭐⭐**I nearly published this as a security hole. What stopped me: running the REAL handler instead of
the echo-stub.** My first probe used the test file's `self-target-cmd` stub, whose handler echoes args —
so the replay returned `ok:true` and *looked* like a self-targeted write succeeding. Only re-probing with
the actual `mcp-tools set` handler showed the `--id is required` throw and `updateAgentGroup` = 0.
**A stub handler cannot tell you whether the real one writes; a test double's success is a fact about the
double.** ⇒ **When a probe's verdict is "this executed", verify WHAT executed.**

## Instrument notes (all four failures were MINE, none were the PR)

- ⛔`/workspace/extra/ephemeral` is **READ-ONLY** despite the name and 532G free — `git clone` there dies
  `could not create work tree dir`. `/tmp` and `/workspace/agent/tmp` are writable. **Probe writability
  with `touch`, never infer it from a path name or `df`.**
- ⛔`vitest --reporter=basic` was REMOVED in v4 — it fails with a `Startup Error / Failed to load custom
  Reporter from basic` stack that reads like a project/deps break. **A tooling-flag error can impersonate a
  repo failure; the giveaway is that it dies before collecting any test.**
- Borrowed `node_modules` via symlink from `/workspace/agent/nanoclaw-kb` works, but that tree lacks
  `js-yaml` (present only under `.pnpm/js-yaml@4.1.1`) — symlink it in explicitly. ⭐The resulting
  `Cannot find package 'js-yaml'` was attributable to my instrument only because the failing import was in
  `claude-composer/registry.ts`, a file this PR never touches.
- The 4 residual `tsc` errors (`@types/js-yaml` ×3, `@chat-adapter/telegram`) are the same borrowed-tree
  artifact. ⭐⭐**Scope the check to the PR's OWN files before reporting a count: `PR_FILE_ERRORS=0` is the
  publishable figure; "4 tsc errors" would have been true-but-misattributed.**

## Test-suite verdict (the author explicitly could NOT run vitest — I could)

`mcp-allowlist.test.ts` **13/13**, `dispatch.test.ts` **60/60**, full host suite **1401 pass / 1 fail /
3 skip**. The 1 fail = `track-critique.test.ts › keeps per-stage isolation…`, a **15s-timeout flake under
full-suite load** (that file's own time was 159s). ⭐⭐**CONTROL PAIR that settled it: 40/40 in isolation on
HEAD *and* 40/40 on base `eb7371a7`.** Base-only would NOT have been enough — a base pass with a HEAD fail
is the signature of a real regression; I needed the HEAD-isolation pass to distinguish load-flake from
regression. `prettier --check` clean on all 9.

**Behavior-change flag (intended, worth stating):** `explicit` winning for admin groups can NARROW a live
group — any admin group with non-NULL `allowed_mcp_tools` gets it enforced at next respawn, where before it
got the full inventory. That IS the fix; flagged so the first post-merge admin respawn is expected. Explicit
`[]` ⇒ `tools: []`, everything blocked, for admin and non-admin alike (verified) — deliberate lockout,
correctly not a fail-open.

**On redelivery:** no-op unless the 🟡 gets a reply or a `global`-scope fix lands. Merge was maintainer's.
