---
name: project_nanoclaw_1133_typecheck_ratchet
description: "nanoclaw#1133 (szihs) widens typecheck past src/ with a shrink-only baseline — the follow-up to MY OWN #1117 finding. MERGED mid-review at 78a5a9ad (7/7 blobs == nv-main BY HASH). 1 🔴 substitution blind spot (count key nets fix+new-fault to zero, control fires), 3 🟡. Comment 5206795254. LIVE on nv-main."
metadata:
  node_type: memory
  type: project
  originSessionId: 6068983b-b2fd-4e0b-b361-04a0a58b0a31
---

# nanoclaw#1133 — typecheck gate widened past `src/`, ratcheted

`slang-coworkers/nanoclaw#1133`, author **szihs**, base `nv-main`, branch
`feat/nv-main/typecheck-ratchet`. Reviewed **INLINE by Main** (standing rule for this repo — never
routed to a `*-pr-approver`; see [[project_nanoclaw_pr874_webhook_route_approver]]). Write path:
`gh api repos/.../issues/1133/comments -X POST` (verb-split; `gh pr review`/`gh pr comment` denied).

**This PR is the follow-up to my own #1117 finding** —
[[feedback_a_green_checker_that_excludes_the_changed_file]]. That review established `tsconfig.json`
has `include:["src/**/*"]` and no `allowJs`, so the cited green `tsc --noEmit` was vacuous for a
`dashboard/public/app.js` change. #1133 closes the `setup/`+`scripts/` half of that hole.

## Race + identity

Two webhooks: `opened` @ `7ea7cbe1`, then `synchronize` @ `78a5a9ad` (+1 commit homing the ambient
stubs under `setup/` and allowlisting `tsconfig.typecheck.json` in path-guard) **while I was
reviewing** — re-fetched and re-measured rather than carrying anything. Then **MERGED 14:22:25Z**,
~6.5 min after opening, mid-review. **All 7 changed blobs verified == `nv-main` BY HASH** (
`nv-main.txt` `dbb69b90`, `ci.yml` `0a70a0dd`, `package.json` `10c8d884`, baseline `fa4351b3`,
gate `ba6c0ce3`, stubs `4a59e7c5`, `tsconfig.typecheck.json` `d5286327`). So the 🔴 is **live on
`nv-main`**. Merge-race count for szihs/`nv-main` keeps climbing — post-merge posture is the default.

## Verified by execution (all in a clean clone, `pnpm install --frozen-lockfile` rc 0)

- Clean run reproduces the body **exactly**: `RC=0`, `ok: 16 diagnostic(s), 12 baselined, no drift.`
- **All four claimed exit paths fire with the stated codes**: new error → 1; stale baseline entry →
  1 + prune text; missing config → 2; invalid config (`"target":"NOT_A_TARGET"`) → 2 "the gate did
  not run"; `include` matching nothing → 2 via the `TS18003`/no-diagnostics guard. Status capture and
  the config-diagnostic branch are genuinely load-bearing, not decorative.
- Count key works: 2nd `TS2454` in `setup/auto.ts` → `now x2, baseline x1`, `RC=1`.
- **Composed-state generalized past the body's `nv-dashboard`-only check.** All four siblings diverge
  under `setup/`+`scripts/` (11 / 10 / 10 / 10 `.ts` files vs this head). Replayed `ci.yml`'s merge
  loop with the real `is_owned` matcher (`git -c core.excludesFile=<nv-main.txt> check-ignore`),
  `OWNED_SRC=HEAD` for a nv-main PR → gate on the composed tree `RC=0`, no drift. Author's
  conclusion holds on the wider set.
  ⚠️**Trap: husky `pre-commit` runs `format:fix` on every merge commit and blew a 2-min timeout.**
  Use `git -c core.hooksPath=/dev/null` + `--no-verify` when replaying a compose loop.
- Coverage really lands: `--listFiles` → `setup` 100/100, `scripts` 39/39 in-program.
- `BROKEN` labels true. `setup/migrate-v2/tasks.ts` **under tsx**: *"does not provide an export named
  'insertTask'"*; control (sibling `sessions.ts`) imports fine. ⚠️**My first probe used
  `node --experimental-strip-types` and died on `src/config.js` resolution — an error about MY
  RUNNER, not the artifact.** `tsx` is the repo's real runner (`package.json` scripts).
- New step ran as its own green CI step; all 5 new/changed paths resolve `nv-main`-owned.

## 🔴 Substitution nets to zero — "no drift" on a file that gained an error

Key is `file + code + count`, so **a fix and a new fault of the same code in the same file cancel**.
Against the largest baseline entry (`setup/index.ts TS2307 x1`, the absent `./groups.js`):
add a shape-correct `setup/groups.ts` (alone → `RC=1` prune, raw tsc 0 diags for the file), then add
`zznew: () => import('./zz-nope.js')` (raw tsc: `setup/index.ts(22,23): error TS2307`) ⇒ gate
**`RC=0`, "no drift"**. **Control fires**: skip the fix, same bad import → `RC=1`, `now x2, baseline
x1`. Reproduced identically on the composed tree. Reachable because the file with baselined entries
is the file someone edits to pay debt down, and **the prune signal is what cancels the new error** —
the honesty mechanism launders the regression. Full lesson:
[[feedback_a_delta_keyed_gate_misses_substitutions]].

⚠️**My first proposed fix (key on message TEXT) caught the substitution but broke the HAPPY PATH**
(`RC=1` on an untouched tree) — `parseBaseline` splits on `/\s+/`, so a spaced message cannot
round-trip. Shipped a **digest** instead (`sha1(msg).slice(0,8)` as a 4th column), validated on four
cases: happy `0`, substitution `1`, plain new error `1`, prune `1`. Published the naive-form warning
alongside so the author doesn't reimplement my failure.

## 🟡 three

- **`"src*"` in the include contributes ZERO files.** A/B: with it 247 in-program, without it 247,
  `comm` diff 0. All 89 `src/` files arrive transitively; `include` is *replaced* by `extends`, not
  merged. Not a CI hole (verified: unimported `src/zz-probe.ts` error missed by the gate `RC=0`,
  caught by the existing `Typecheck host` step `RC=2`) but the entry reads as coverage it doesn't
  provide. `"src"` → 486 in-program and the gate is **still `RC=0`** ⇒ free today.
- **"may only shrink" documented 3×, enforced 0×** — `--write` grows 12→13 with `# TODO: explain or
  fix` and CI goes green; no consumer of the file exists besides the gate. See
  [[feedback_a_documented_invariant_with_no_enforcer]].
- **`ok: 16 diagnostic(s)` counts the one it refused to judge** — `parsed++` precedes the
  `OUT_OF_SCOPE` filter, so the `container/**` `bun:sqlite` `TS2307` is in the total. In-scope raw =
  **15**, baseline counts sum = **15**.

## Note posted on the 162 figure / next tranche

Body's headline "162 `.ts` files" = 136 (`setup` 98 + `scripts` 38, per its own table) + **26 under
`.claude/skills/**`** which are in **neither** program. Covered set is really 139. Adjacent and not
the author's: `vitest.skills.config.ts` includes `.claude/skills/**/tests/*.test.ts` → matches **0
files** (they live at `.claude/skills/<name>/*.test.ts`, no `tests/` dir) and that config is
referenced by no workflow or script ⇒ those 16 test files are typechecked by nothing and run by
nothing. Same hole shape, one directory over.

## Resume

Comment `5206795254`. MERGED, so nothing to gate — 🔴 + 3 🟡 are **LIVE on `nv-main`**; one follow-up
closes all four. RESUME = szihs replies, or a follow-up PR appears touching
`scripts/typecheck-gate.mjs` / `tsconfig.typecheck.json`. ⭐**This author ships responsive commits
within minutes** (#1103: 5 heads) — on any redelivery, re-fetch the head SHA and re-run the
substitution probe **with its control** before restating the 🔴.
