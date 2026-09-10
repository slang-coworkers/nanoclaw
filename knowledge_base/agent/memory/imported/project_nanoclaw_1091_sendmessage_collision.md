---
name: project_nanoclaw_1091_sendmessage_collision
description: "slang-coworkers/nanoclaw#1091 nv-nanoclaw upstream sync — disallows built-in SendMessage; reviewed inline (routing rule 10th instance), MERGED mid-review, clean, and the fix is NOT live in this container"
metadata:
  node_type: memory
  type: project
  originSessionId: pr1091-webhook
---

**slang-coworkers/nanoclaw#1091** — `Sync nv-nanoclaw with upstream/main`, branch
`sync/upstream-nv-nanoclaw` → **`nv-nanoclaw`**, author `nv-slang-bot[bot]`
(`sync-upstream.sh` automated periodic sync). 3 files, **+42/−3**. Parent
[[project_nanoclaw_pr874_webhook_route_approver]] · index
[[slang-nanoclaw-chains-index]].

**Handled INLINE by Main — NOT routed. 10th instance of the standing rule.** The
`pr_ready_for_review` webhook again carried the generic post-#874 "Route it to the
project's `*-pr-approver` coworker (never a reviewer/fixer)" task string. Standing
rule overrides: NanoClaw-platform fork, **no nanoclaw approver wired**; a
slang/slangpy COMPILER approver at a nanoclaw-repo sync PR is nonsensical.

## Content — genuinely small and genuinely good

Upstream `dim0627`/`claude` fix (upstream PR #3187, commit `81b18a9f`): Claude Code's
built-in `SendMessage` addresses the **SDK's own in-session subagents**, unrelated to
NanoClaw agent groups — but the name reads as the obvious way to message another
agent, so an agent fresh off `mcp__nanoclaw__create_agent` reaches for it and gets
`No agent named 'x' is currently addressable`, reads that as *"the group was never
provisioned"*, and retries the same wrong tool. `mcp__nanoclaw__send_message` never
gets called. Fix moves `SendMessage` from `TOOL_ALLOWLIST` **into**
`SDK_DISALLOWED_TOOLS`, so it hits both legs: SDK `disallowedTools` (`claude.ts:671`)
and the `preToolUseHook` block (`claude.ts:311`).

✅ **The PR body's key negative claim is CORRECT and mechanically checked, not taken
on trust**: *"removing it from `TOOL_ALLOWLIST` alone would not help"* — verified
`permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true` at
the same call site (`claude.ts:677-678`), so the allowlist is an auto-approve list,
not a gate. Removal alone would be inert; the disallow is what does the work.

✅ **New test `claude.tool-collisions.test.ts` VERIFIED NON-INERT with TWO negative
controls** (ran locally, `bun test`, 3 pass / 5 expects):
- delete `'SendMessage'` from `SDK_DISALLOWED_TOOLS` → **1 fail** (`toContain`).
- re-add `'SendMessage'` to `TOOL_ALLOWLIST` → **2 fail**, incl. the
  `no tool is both allowlisted and disallowed` overlap invariant.
Both halves of the fix are pinned, and the `export` of the two consts exists
**only** so the test can reach them (enumerated: the test file is the sole new
consumer).

✅ **Merged-blob identity BY HASH** — merge commit `c69c26de` vs reviewed head
`ac55082d`: all 3 blobs identical (`claude.ts` `f88a4a98…`, test `2945cbd0…`,
`CHANGELOG.md` `3e094a0b…`).

✅ **Sync faithfulness by blob hash vs upstream `358f1a81`**: test + `CHANGELOG.md`
**byte-identical to upstream**. `claude.ts` differs — and the delta is **entirely a
PRE-EXISTING fork change**, not a bad merge: the only hunk is the transcript-rotation
`fs.rmSync`-vs-rename block, and `diff base…head` on that region = **0 lines**
(`fs.rmSync` present on base `48de894c`, absent upstream ⇒ fork-local, untouched by
this sync).

✅ **CI green, and read as a run not a rollup**: `ci` SUCCESS (run 31014994021,
14:28:31→14:30:49), **all 17 steps success** incl. `Typecheck container` and
`Container tests` (`bun test`), which is where the new test actually executes.

## 🔴 The finding that matters — the fix is NOT live in this container

**MEASURED in the running runner, not inferred.** `/app/src/providers/claude.ts` is
the loaded artifact for this session:
- `SDK_DISALLOWED_TOOLS` (live, printed in full) = 11 entries, **`SendMessage` ABSENT**.
- `BASE_TOOL_ALLOWLIST` (live) **CONTAINS `'SendMessage'`** at line 74.

⛔⭐⭐⭐ **MY OWN GREP NEARLY SHIPPED THE OPPOSITE CONCLUSION.** `grep -n
"'SendMessage'" /app/src/providers/claude.ts` returned `74: 'SendMessage',` — a hit,
which reads as *"the fix is live here."* It is the **exact inverse**: line 74 is
inside the **allowlist**, the pre-fix state. Only re-running scoped to the enclosing
`const` block (`sed -n '/^const SDK_DISALLOWED_TOOLS = \[/,/^\];/p'`) disambiguated.
⇒ **A bare token grep cannot tell WHICH LIST a name is in, and for a fix that MOVES a
string between two lists, presence/absence of the token is not the question — the
CONTAINING BLOCK is.** Same family as
[[feedback_a_null_guard_inside_a_truthiness_branch_is_dead]] (read the enclosing
scope, not the matching line) and
[[feedback_a_guard_can_be_inert_and_read_as_passing]].

Also live-verified: the live file still names the const `BASE_TOOL_ALLOWLIST` (renamed
to `TOOL_ALLOWLIST` upstream) and lacks the `export`s ⇒ the running image predates the
whole change. **Consequence: agent-to-agent `SendMessage` confusion is still
reachable in this container until the image is rebuilt** — the merge fixed the branch,
not the running fleet.

## State / posture

`state: MERGED` — `createdAt 14:23:57Z` → `mergedAt 14:31:34Z`, **7m37s, merged by
`nv-slang-bot` MID-REVIEW**. ⇒ **MERGE-RACE COUNT IS NOW EIGHT** (#1066 −26s, #1068
+104s, #1071 mid-session, #1075 +8.5min, #1078 +2.8min, #1079 +11min, #1082 +5.5min,
**#1091 +7.6min**). Merge landed **44s after `ci` went green** ⇒ this looks like
green-gated bot self-merge, not a human race. 0 reviews, 0 comments, not draft.

**NOT routed, NOT commented, NOT escalated.** Bot-authored automated sync;
`sync/upstream-*` sits outside the [[feedback_nv_coworkers_automerge]] grant; nothing
substantive to add to a clean, green, already-merged upstream cherry-pick (comment
hygiene, consistent with the whole #874 lineage).

## ⚠️ Instrument note — `check` (nv-path-guard) DOES NOT RUN on this branch

`nv-path-guard.yml` lists `nv-nanoclaw` in its `branches:` trigger, so the guard
*looks* armed for this PR. It is not: **the workflow file and all 6
`.github/nv-path-guard/*.txt` configs exist ONLY on `nv-main`** (enumerated across 7
branches; control `ci.yml` = 1 everywhere). A `pull_request` workflow runs from the
**PR head**, and this head is `nv-nanoclaw`-based ⇒ no workflow file ⇒ no job.
Corroborated by a check-run census: every `nv-nanoclaw`-targeting PR (#1091, #1028,
#1001, #883, #831) reports only `ci,label`, while `nv-main`-targeting PRs (#1086,
#1052) report `check,ci,label` — the positive control that makes the absence real.
⇒ **A branch named in a workflow's trigger list is NOT evidence the workflow runs
there; the file has to exist at the head.** Benign here (this PR touches only
`container/agent-runner/**` + `CHANGELOG.md`, which are `nv-main`-owned anyway — so
had the guard run, it would arguably have flagged the sync), but do not cite `check`
as a passing gate on any overlay-branch PR.

**On redelivery:** no-op. Terminal/merged, clean, green. The one live item is the
**stale container image**, which is an operator/rebuild concern, not a PR action.
