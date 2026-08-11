---
name: project_nanoclaw_1171_pr_mapping_first_claim_wins
description: "nanoclaw#1171 (szihs) makes pr_session_mappings first-claim-wins + attributes append_learning. Reviewed INLINE (~32nd no-nanoclaw-approver instance), comment 5238396420, MERGED mid-review (8th race). 1🔴 the per-group learnings subdir is invisible to 3 flat globs incl. the LIVE wiki builder (executed); 3🟠 incl. denySelfTarget never firing."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1171
---

# nanoclaw#1171 — pr-mapping first-claim-wins

PR https://github.com/slang-coworkers/nanoclaw/pull/1171, author **szihs**, base **`nv-main`**,
head `36fbe7a8ecf1f261a56cec4244d119aa64cef61f`, base `0280ead6edeae259d11203127b29e3f12ab67520`,
14 files **+1145/−216**. My comment **`5238396420`**. Direct successor to
[[project_nanoclaw_1157_mcp_allowlist_failopen]] / [[project_nanoclaw_1164_mcp_allowlist_external_scope]] —
it closes the two `KNOWN_WEAK` built-ins those PRs recorded.

Deletes `upsertPrMapping` (unconditional `INSERT OR REPLACE`); adds `claimPrMapping`
(first-claim-wins, holder-may-refresh, keyed on `(instance, agent_group)` **not** session) +
`overridePrMapping` (sole unconditional writer, only caller = approval-gated
`ncl pr-mappings remap`). Both agent-reachable writers (delivery action + `/internal/register-pr`)
now route through the claim. Plus `append_learning` provenance: front-matter author, per-group
subdirectory, index shows author.

**Routing: handled INLINE by Main, ~32nd instance.** Webhook again carried the generic
*"Route it to the project's `*-pr-approver` (never a reviewer/fixer)"*, which targets PRODUCT
repos; destinations hold only `slang-pr-approver`/`slangpy-pr-approver`, repo-scoped to
shader-slang code ⇒ would `ABSTAIN_POLICY`. See [[project_nanoclaw_pr874_webhook_route_approver]].
**The duplicate `opened` webhook arrived ~55 min after the first — same chain, no re-dispatch.**

## MERGED MID-REVIEW (8th race) — and the blob check is what made findings safe to publish

`merged_at 2026-08-10T08:37:31Z` by szihs, merge commit `505f69432d6c5adfd3d6f323f6b574d82efc4e8e`,
~10 min after the webhook. Prior races: #1066/#1068/#1071/#1075/#1078/#1162/#1164.
⭐ Went past "head SHA didn't move": `git rev-parse <sha>:<path>` on all 10 finding-bearing files
vs `origin/nv-main` ⇒ **8 SAME**. The 2 DIFF (`scripts/kb-health.py`, `docs/mcp-allowlist.md`)
drifted from **#1168/#1170 rewriting unrelated regions 20–40 min earlier**; #1171's own lines
survive verbatim, **and the `kb-health.py:144` glob my 🔴 rests on is unchanged at the tip** —
I checked the specific line, not just the file. All 4 checks green at merge (`ci` was
`IN_PROGRESS` on arrival → pending-on-arrival is not a finding).

## 🔴 The per-group learnings subdir is invisible to THREE flat globs — including the LIVE builder

`handleAppendLearning` writes `<authorDir>/<ts>-<slug>.md` (`append-learning.ts:146,154`).
Readers that glob one directory deep:

| consumer | line | pattern |
|---|---|---|
| wiki `l1_stems()` | `container/skills/learnings-wiki/SKILL.md:447` | `glob(L1/*.md)` |
| wiki `build()` | `SKILL.md:634` | `glob(L1/*.md)` |
| `kb-health.py atom_stats()` | `scripts/kb-health.py:144` | `glob(learn_dir/*.md)` + `^\d{13}-` |

⭐⭐⭐**EXECUTED AGAINST THE DEPLOYED BUILDER, not the repo copy**: ran
`/workspace/shared/.learnings_wiki.py` (17,985 B, Aug 4) with `WIKI_KB_ROOT` at a scratch root
holding 1 flat + 1 per-group atom → `built: 1 learnings`, and the attributed atom appears in
**neither** `sources/learnings/` nor `wiki/learnings/`. `wiki/` **is** the mandated reading
surface (`container/spines/base/context/workspace.md:4` — read `wiki/index.md` → ≤2 concepts;
**never** `learnings/INDEX.md` inline, 492 KB today).

Three amplifiers, each constructed:
1. **The wake gate is `find` (RECURSIVE); the builder is `glob` (NOT).**
   `docs/scheduled-tasks.slang-coworkers-prod.md:394` fires `wakeAgent:true`, then `build()`
   returns nothing ⇒ daily task wakes, pays, reports "0 new", forever.
2. ⭐⭐**`kb-health.py:204` reports PERFECT PARITY while atoms strand.** 3 mirrored flat +
   5 unmirrored per-group → `{'learnings':3,'sources':3,'wiki':3}`. **The instrument fails toward
   "healthy"** — same family as [[technique_keeping_this_store_reachable]]'s collapse-to-a-true-
   number-about-a-set-you-never-saw.
3. **Live: 3,979 flat `*.md`, 0 subdirs** ⇒ nothing stranded YET; starts on the next write.

⭐⭐**CHASED THE 122 GAP INSTEAD OF ASSUMING IT** (`sources`/`wiki` at 3,857 each). It is ordinary
backlog, not stranding: `find learnings -maxdepth 1 -newer wiki/index.md` → **123** atoms since the
Aug 9 06:37 build, and **0** atoms carry `superseded_by`. Had I published it as evidence of the
🔴 it would have been a false corroboration of a true finding.

Remedy verified BOTH directions on the live builder: `glob(L1/*.md)` → `glob(L1/**/*.md,
recursive=True)` (3 sites) ⇒ `built: 2`, both atoms present, flat atom unaffected.
The PR's own `renderLearningsIndex` is CORRECT — executed it, emits
`- [attributed new](ag-fixer/….md) — _ag-fixer_` beside `— _unattributed_`. The defect is entirely
in the unchanged consumers. Spine's `Grep learnings/` fallback is fine (ripgrep recurses).

## 🟠 `denySelfTarget: true` on `pr-mappings remap` NEVER FIRES

`pr-mappings.ts:66` sets it; the guard leg is `cli/guard.ts:108` `args.id === actor.agentGroupId`.
**The verb has no `--id`** (by design: `--repo/--pr/--session`, group derived from session) ⇒
`undefined` never matches. Real guard on real registered command:

| scope | effect |
|---|---|
| `global`, self-target | **hold** — "requires admin approval" (the card the comment says must never be minted) |
| `group`, self-target | deny — but only because `pr-mappings` ∉ `GROUP_SCOPE_RESOURCES` (`registry.ts:20`), which also denies `list` |

⭐**NOT exploitable — and getting that right mattered.** The HANDLER's explicit check is what
holds: executed with `caller:'agent'`/`ag-attacker` → throws *"An agent cannot remap a PR to its
own agent group"*, incumbent still `ag-fixer`. Approval **replay** re-dispatches through handlers
(`dispatch.ts:238-241`, carries `callerContext`) ⇒ an approved card hits the same refusal.
So the defence is real but sits one layer below where the code claims it. Contrast `groups.ts:159`
where `denySelfTarget` works because there `--id` IS the group and dispatch auto-fills it.
⇒ Same shape as #1164's canary: **a tell designed but not wired**
([[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]]).

## 🟠 The remedy the 409 names cannot fix the cross-instance case the 409 is about

`register-endpoint.ts` 409s with `remedy: 'ncl pr-mappings remap …'`, but remap
(a) `getSession(sessionId)` → a lego session id is absent from prod's table, executed
`rejects.toThrow(/No session sess-lego-3/)`; (b) `pr-mappings.ts:107` `ownerInstance: INSTANCE_SLUG`,
**the file's only occurrence, no flag** ⇒ no invocation can produce a peer-owned row. Prod group
capturing a lego PR is hand-SQL-only.

## 🟠 "the peer's agent does learn locally" — MEASURED FALSE

PR's *Not fixed here* claims it. Ran the peer leg (`INSTANCE_SLUG='lego'`, `PR_MAPPINGS_LOCAL=1`,
remote leg isolated, peer cache EMPTY for that PR — the realistic state):
`peer cache row → lego/ag-lego-fixer` (claim SUCCEEDS), `agent notices → 0 []`.
First-claim-wins is **per-table**; the peer has no incumbent to refuse against. `postRegisterPr`
(`register-client.ts:80`) throws on 409 but `index.ts` catches it into `log.warn` by design.

## 🟡 "no unconditional writer left to reach by accident" is true of AGENTS, not the codebase

`overridePrMapping` (`store.ts:236`): only non-test importer is `cli/resources/pr-mappings.ts:21`
(measured); `upsertPrMapping` → **0** refs in `src/`. But it's a plain export kept single-caller by
nobody having imported it — exactly `upsertPrMapping`'s property until it was the hole.

## Verified as claimed / gates

Revert drill (restored 3 non-test files to base, kept new tests): **8 fail / 4 pass**, assertion
text matching the PR body verbatim (`'ag-attacker'` vs `'ag-fixer'`; `200` vs `409`;
`expected [] to have a length of 1`). Head: 57/57 across 7 suites. Full host `vitest run`
**2321 pass/3 skip/2 suite-fail**; **base control 2290 pass, same 2 fails** ⇒ no regression.
`prettier --check "src/**/*.ts"` clean. `tsc --noEmit` 4 head / **4 base** (my symlink artifacts).
Three rejected proof mechanisms all check out: marker has **0** host-side refs (`docs/cross-
instance-routing.md:38` correction is right); all coworkers push as `nv-slang-bot`;
`chain-reporting.md:114` does mandate draft-held PRs.

⛔**CORRECTED THE PR'S BASELINE CLAIM:** it says 9 vitest failures (7 `scripts/q.test.ts` +
2 `src/gate-plan-script.test.ts`). **I ran both suites: 24/24 GREEN**, and I see 1 + the import
failure. Re-ran on base before saying so ⇒ the no-regression CONCLUSION holds, only the baseline
description is wrong. Same lesson as #1164's Bun.YAML mismatch:
**a baseline needs re-running on your own edge, never quoting.**

## Instrument notes

- KB clone `node_modules` still lacks top-level `js-yaml` (only `.pnpm/js-yaml@4.1.1/`) — symlink
  it or `claude-composer/registry.ts` imports die. 3rd occurrence (#1116, #1157, here).
- `git worktree add --detach <sha>` + symlinked `node_modules` for head AND base = cheap
  differential; throwaway `src/probeX.test.ts` inside the real tree gives real registry/mocks.
- `--reporter=verbose` required to see `console.log` from a PASSING vitest test.
- Write path: `gh api repos/.../issues/1171/comments --method POST -F body=@file`.
  `gh pr view --json merged` is **rejected** ("Unknown JSON field") — use
  `gh api repos/O/R/pulls/N --jq '{merged,merged_at}'`.

**RESUME** = szihs replies, or the recursive-glob follow-up lands. All findings live on `nv-main`
at `505f6943`. Recommended the 🔴 as its own small PR (wiki/health tooling), not a reopen —
the provenance write path here is right.
