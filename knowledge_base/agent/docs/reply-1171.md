Reviewed post-merge (merged `08:37:31Z` by szihs as `505f6943`, ~10 min after the `opened` webhook — 8th merge race in this series). **All 8 finding-bearing files are byte-identical to `nv-main` tip `505f6943` by `git rev-parse <sha>:<path>`**, so everything below is live on `nv-main`, not a comment on a superseded diff. The two files that differ (`scripts/kb-health.py`, `docs/mcp-allowlist.md`) drifted only because #1168/#1170 rewrote unrelated regions 20–40 min earlier; this PR's own lines survive verbatim, and the `kb-health.py` glob a finding below rests on is unchanged at the tip.

Verdict: **the core fix is real and correct, and the revert drill proves it behaviourally.** I restored `store.ts` / `index.ts` / `register-endpoint.ts` to base `0280ead6` and kept the new tests: **8 fail / 4 pass**, with exactly the assertion text the PR body quotes (`expected { agent_group_id: 'ag-attacker' } to match { agent_group_id: 'ag-fixer' }`, `expected 200 to be 409`, `expected [] to have a length of 1`). At head: **57/57** across the 7 pr-mapping/learnings/gate suites; full host `vitest run` **2321 pass / 3 skip**, and the 2 failures (`setup/register.test.ts` import, `scripts/check-runtime-resolvable.test.ts`) reproduce identically on base (2290 pass, same 2) — no regression. `prettier --check "src/**/*.ts"` clean; `tsc --noEmit` 4 errors head, **4 on base** (all artifacts of my symlinked `node_modules`, not yours).

One correction to your acceptance table: you list the vitest baseline as **9** failures (7 `scripts/q.test.ts` + 2 `src/gate-plan-script.test.ts`) plus the `register.test.ts` import. On my edge those two suites are **24/24 green**, and I see **1** failure plus the import failure. I re-ran the identical suites on base before saying so, so the *conclusion* (no new failures) holds — only the description of which failures are baseline is wrong, most likely a local-env difference. A baseline claim needs re-running on the reader's edge, not quoting.

---

## 🔴 `append_learning`'s per-group subdirectory makes every new learning invisible to the wiki, the reading surface, and the health check

This is the one I'd act on. It is not a flaw in the provenance design — it's that the layout change lands under three consumers that all glob **one directory deep**, and none of them is in this PR's diff.

`handleAppendLearning` now writes to `<authorDir>/<ts>-<slug>.md` (`append-learning.ts:146,154`). Three readers cannot see that:

| consumer | line | pattern |
|---|---|---|
| `learnings-wiki` builder `l1_stems()` | `container/skills/learnings-wiki/SKILL.md:447` | `glob(L1/*.md)` |
| same builder, `build()` | `SKILL.md:634` | `glob(L1/*.md)` |
| `kb-health.py` `atom_stats()` | `scripts/kb-health.py:144` | `glob(learn_dir/*.md)` + `^\d{13}-` basename filter |

**Executed against the live production builder**, not read. I created one flat atom and one per-group atom under a scratch root and ran `/workspace/shared/.learnings_wiki.py` (the deployed copy, 17,985 bytes, Aug 4) with `WIKI_KB_ROOT` pointed at it:

```
built: 1 learnings | secrets redacted 0 | groups [('misc', 1)]

sources/learnings/1700000000001-flat-old.md      ← the flat one
wiki/learnings/1700000000001-flat-old.md
(the attributed atom appears NOWHERE)
```

That matters because `wiki/` **is** the reading surface. `container/spines/base/context/workspace.md:4` tells every coworker to recall through a subagent that reads `wiki/index.md` → ≤2 `wiki/concepts/*.md`, and explicitly **not** to read `learnings/INDEX.md` inline (it is 492 KB today). So a learning written after this change is correctly attributed, correctly indexed by your new `renderLearningsIndex` — I ran it, it emits `- [attributed new](ag-fixer/…md) — _ag-fixer_` alongside `— _unattributed_`, exactly as designed — and still never reaches the surface agents are instructed to read.

Three things make this worse than a normal follow-up:

1. **The scheduled task's wake gate uses `find`, which *is* recursive.** `docs/scheduled-tasks.slang-coworkers-prod.md:394` is `find /workspace/shared/learnings -name '*.md' -newer wiki/index.md`. Constructed: the gate fires `wakeAgent:true`, then `build()`'s glob returns nothing. The daily task wakes, pays for a synth run, and reports "0 new" — every day, indefinitely.
2. **`kb-health.py` cannot see the loss, and reports perfect parity.** Its mirror block (`:204`) counts `learnings/*.md`, `sources/learnings/*.md`, `wiki/learnings/*.md` — all three flat. Constructed with 3 mirrored flat atoms + 5 unmirrored per-group atoms: `{'learnings': 3, 'sources': 3, 'wiki': 3}`. Parity looks *perfect* while 5 atoms are stranded. The instrument fails toward "healthy".
3. **Live state says this starts on the next write.** Re-measured at post time: `/workspace/shared/learnings/` holds **3,979** flat `*.md` and **zero** subdirectories; `sources/learnings` and `wiki/learnings` are at **3,857** each. I chased that 122 gap rather than assume it — it is ordinary backlog, not stranding: `find learnings -maxdepth 1 -newer wiki/index.md` returns **123** atoms written since the last build (`wiki/index.md`, Aug 9 06:37), which accounts for it, and 0 atoms carry `superseded_by`. So nothing is stranded *yet*; every atom from the next `append_learning` on is.

**Remedy verified both directions** on the live builder: `glob(L1/*.md)` → `glob(L1/**/*.md, recursive=True)` (3 sites) gives `built: 2 learnings` and both atoms present in `sources/` and `wiki/`; the flat atom is unaffected. `kb-health.py:144`'s `^\d{13}-` filter needs to match on basename after a recursive walk, and `:204`'s mirror count needs the same. The spine's `Grep /workspace/shared/learnings/` fallback is fine either way — ripgrep recurses.

I'd take the recursive-glob change as its own small PR rather than reopening this one; the provenance write path here is right.

## 🟠 `denySelfTarget: true` on `pr-mappings remap` never fires — the handler check is what's actually holding the line

`pr-mappings.ts:66` sets `denySelfTarget: true`, and the comment beside it says self-targeting is "refused outright, not turned into an approval card a human might wave through". The guard leg it relies on is `cli/guard.ts:108`:

```ts
if (cmd.denySelfTarget && args.id === actor.agentGroupId) {
```

It keys on **`args.id`**. This verb has no `--id` — by your own design it takes `--repo`/`--pr`/`--session` and derives the group from the session, which is the right call. So the predicate compares `undefined` against the caller's group and never matches.

Asked the **real guard** about the **real registered command** (a throwaway probe inside the tree, real registry):

```
cli_scope=global, self-target → hold  | agent-initiated "pr-mappings-remap" requires admin approval
cli_scope=group,  self-target → deny  | CLI access is scoped to this agent group. Cannot access "pr-mappings"
```

`hold`, not `deny` — the approval card the comment says must never be minted, is minted. (Contrast `groups.ts:159`, where `denySelfTarget` works because that verb's `--id` *is* the group id, and dispatch auto-fills it.)

**Not exploitable today, and this is the part worth stating precisely:** the *handler's* explicit check is real and it is what stops the attack. Executed it directly — `caller: 'agent'`, `agentGroupId: 'ag-attacker'`, `--session` resolving to `ag-attacker` — it throws `An agent cannot remap a PR to its own agent group`, and the incumbent row is still `ag-fixer` afterward. And the approval-replay path runs handlers exactly as a direct call does (`dispatch.ts:238-241` re-dispatches with the grant, carrying `callerContext` through), so even an approved card hits the same refusal. Under `cli_scope: 'group'` the resource isn't reachable at all — `pr-mappings` is not in `GROUP_SCOPE_RESOURCES` (`registry.ts:20`), which also means `list` is denied to every non-`global` group.

So the defence holds, but it holds one layer down from where the code says it does. Two consequences: an operator gets a card for an escalation attempt that the comment promises will be refused before any human sees it, and the belt-and-braces reading ("`denySelfTarget` **plus** an explicit check") is really one brace. Either extend the guard leg to consult a declared self-target arg, or drop the flag and let the comment credit the handler — the flag reads as coverage it isn't providing. Same shape as the canary finding on #1164: a tell that was designed but not wired.

## 🟠 The remedy the 409 names cannot fix the cross-instance case the 409 is about

`register-endpoint.ts` answers a refused peer claim with `409 { held_by, remedy: 'ncl pr-mappings remap …' }`. But `remap` derives everything from a **local** session and hardcodes the owner:

- `pr-mappings.ts:104` — `getSession(sessionId)`, then `throw new Error('No session …')`. A lego session id does not exist in prod's `sessions` table. Executed: `rejects.toThrow(/No session sess-lego-3/)`.
- `pr-mappings.ts:107` — `ownerInstance: INSTANCE_SLUG`, the sole occurrence in the file. There is no flag, so **no invocation of `remap` can ever produce a peer-owned row.**

So when a prod group has captured a PR that belongs to a lego session, the remedy printed in the 409 body and in the `store.ts:205` ERROR log cannot restore it. The row has to be fixed by hand in SQL. Worth either scoping the remedy string to the local case or accepting `--owner-instance`.

## 🟠 "the peer's agent does learn locally" — measured false

Your *Not fixed here* section says the cross-instance surfacing gap is only that a refused peer registration lands in the canonical instance's logs, and adds: *"The peer's own local cache write is refused by the same rule, so the peer's agent does learn locally."*

Ran the peer leg — `INSTANCE_SLUG='lego'`, `PR_MAPPINGS_LOCAL=1`, remote leg isolated, the peer's cache table **empty** for that PR (which is the realistic state, since the incumbent lives in prod's table):

```
peer cache row  → lego/ag-lego-fixer     ← claim SUCCEEDS locally
agent notices   → 0  []                  ← agent told nothing
```

First-claim-wins is per-table, and the peer's table has no incumbent to refuse against. So the peer's agent gets a clean local `claimed`, its cache says it owns the PR, and the only refusal exists in prod's log — the agent learns nothing, locally or otherwise. The gap is one notch wider than documented. `postRegisterPr` (`register-client.ts:80`) does throw on the 409, but `index.ts` catches it into a `log.warn` by design, so nothing reaches the agent.

## 🟡 `store.ts`'s "no unconditional writer left to reach by accident" is true of *agents*, not of the codebase

`overridePrMapping` is exported (`store.ts:236`); its docstring says "its single caller is the approval-gated `ncl pr-mappings remap`" and it "is not reachable from a container". Both true as measured — the only non-test importer is `cli/resources/pr-mappings.ts:21`, and `upsertPrMapping` is down to **0** references anywhere in `src/`. But it is a plain export in a module every host-side file can import, and the thing keeping it single-caller is that nobody has imported it — the same property `upsertPrMapping` had right up until it was the hole. `guard/conformance.test.ts` already demonstrates the pattern for pinning a claim like this to the code rather than to a comment; an assertion on `overridePrMapping`'s importer set would make the docstring enforceable.

## Verified as claimed, not read

- **Holder is `(instance, group)`, not session** — `sameClaimant` (`store.ts:143`) confirmed; the refresh path is exercised by `lets the holder re-register after its container restarts into a new session`, which fails on base with `expected { ok: true } to match { outcome: 'refreshed' }`.
- **`learningAuthorDir` excludes dots from the allowed set** — `[^a-zA-Z0-9_-]` → `_`, so no input yields `.` or `..`. Safer than sanitize-then-check, as stated.
- **Both writers go through `claimPrMapping`** — `upsertPrMapping` has 0 remaining references; `claim-parity.test.ts`'s last test runs one takeover through both and asserts the outcomes match, so drift turns one red.
- **The failing-first honesty is accurate**, including the two admissions. `append-learning.provenance.test.ts` does fail pre-fix as missing symbols, and the old `store.test.ts` really did contain `replaces an existing mapping (last-writer-wins)` — the vulnerability written down as an expectation. Saying so is the right call.
- **The three rejected proof mechanisms check out.** The marker is skill text the host never parses (0 host-side references; your `docs/cross-instance-routing.md:38` correction is right); every coworker pushes as `nv-slang-bot`, so author identifies nothing; and `chain-reporting.md:114` does mandate draft-held PRs, which a webhook-prerequisite rule would reject. "Ordered, not proved" is the honest framing, and putting the reasoning in `store.ts` rather than the PR body is the right place for it.
- **The canary move is the right shape** — asserting `KNOWN_WEAK` is empty makes *adding* a knowingly-weak built-in the deliberate act. `HANDLER_ENFORCED` is the correct bucket: this is an argument-vs-state check, which the guard seam can't express.

None of the above argues against the merge. The 🔴 is a follow-up in the wiki/health tooling, not a defect in this diff.
