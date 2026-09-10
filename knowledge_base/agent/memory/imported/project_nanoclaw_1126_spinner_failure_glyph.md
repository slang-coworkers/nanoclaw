---
name: project_nanoclaw_1126_spinner_failure_glyph
description: "nanoclaw#1126 (szihs, nv-main) s.stop(msg,1)→s.error. MERGED +4min; reviewed post-merge, 4/4 blobs == nv-main BY HASH. Fix correct, guard non-vacuous (base→6 offenders). 1 MISSED site photon-setup.ts:811 (1-arg, guard blind); severity split 3-of-6 had no other red marker; adjacent PRE-EXISTING insertTask break drops every task in v1→v2 migration, fails GREEN."
metadata:
  node_type: memory
  type: project
  originSessionId: 45b5ea1b-4172-44e3-8324-16407bf67f6f
---

# nanoclaw#1126 — setup spinner failure glyph

`slang-coworkers/nanoclaw#1126`, author **szihs**, branch `fix/nv-main/spinner-failure-glyph`
→ `nv-main`. Head `19479a293`. 4 files, +132/−7. Comment `5206303176`.

⛔ **MERGED 13:58:39Z — 4 min after opening (13:54:24Z)**, merge commit `71c24bebb`, while I was
still fetching. Verified all 4 blobs at `nv-main` tip == reviewed head **BY HASH**
(`ac53278ef`/`96097c52e`/`3b328af89`/`0722be9f0`), re-checked after 2 later merges landed.
**Merge-race count for szihs/`nv-main` continues** — recheck `state` immediately before posting.

**Routing: handled INLINE by Main** — the `pr_ready_for_review` webhook again carried the generic
*"Route it to the project's `*-pr-approver`"* task string. Nanoclaw is a platform-infra repo; the
only approver destinations are repo-scoped compiler approvers. See
[[slang-nanoclaw-chains-index]], [[project_nanoclaw_1119_fail_closed_task_snapshot]] (4th).

## ✅ Verdict: fix correct, diagnosis exact, guard genuinely non-vacuous

`s.stop(msg, 1)` → `s.error(msg)` at 6 sites. Clack 1.2.0 minified source:
`stop:(_="")=>W(_,0)` — the `0` is a **literal at the call**, so arg 2 is dropped by arity;
`cancel`→`W(_,1)`, `error`→`W(_,2)`, and `W` picks the glyph from that code alone.
Rendered from the tree's own `node_modules` by capturing `process.stdout.write`:
`stop(m,1)`→`◇`, `stop(m)`→`◇` (**byte-identical, string equality on full output**),
`cancel`→`■`, `error`→`▲`.

⭐⭐ **`error` vs `cancel` is PURELY presentational and I checked rather than assumed**: `isCancelled`
stays `false` and the `onCancel` callback does **not** fire for either — so the semantic argument is
the ONLY one available (take it). Under `TERM=linux` both degrade to the same ASCII `x`.

**Non-vacuity by EXECUTION, not reading**: restored the 3 sources to base `f03cff946`, ran the
committed test → `expected [ 'setup/auto.ts:299', …(5) ] to deeply equal []`, exactly the six
listed sites; 3/3 pass again at head. AST-over-grep is load-bearing and confirmed:
`tz-from-claude.ts` had its `1` on line **69** with `.stop(` on **65** — 4 lines apart.

**`tsc` delta reproduces; absolutes differ by exactly 3 in BOTH directions** (mine 21→15, body
18→12). Gap = 3 `TS2307` (`js-yaml`×2, `@chat-adapter/telegram`×1) from my partial `node_modules`;
both are real `package.json` deps. **`TS2554` 6→0** at the same six lines. ⭐⭐*Same delta, different
env ⇒ quote THEIR absolutes, publish MY delta.*

**Bug is LIVE UPSTREAM** — `nanocoai/nanoclaw@743e32df4:setup/lib/runner.ts` is blob `0e4afef08`,
**identical to this fork's base**; upstream `auto.ts:284/419/429/828` + `tz-from-claude.ts:65` carry
all six; `spinner-outcome.test.ts` absent upstream ⇒ fork-only fix for an upstream defect.
⚠️`gh api repos/nanocoai/...` 401s (token reads the fork only) — **had to `git fetch upstream main`**;
positive control: same call on the fork returned `.size` fine.

## 🔴 One site with the SAME bug was missed — `scripts/photon-setup.ts:811`

`spin.stop('Login failed')` then `p.cancel(err)` → renders `◇ Login failed` (GREEN) above a red `└`.
**It passes only ONE arg, so the committed guard cannot see it** — ran the PR's own
`overArgumentedStopCalls` against the file → `[]`. Also outside the `['setup','src']` walk, so
widening the detector alone wouldn't catch it. AST census of **all 31** `.stop(...)` sites repo-wide:
exactly **one** failure-worded single-arg `stop` (this; `:815 'Logged in'` is the adjacent success
control). ⇒ ⭐⭐⭐**An argument-count detector cannot find the same bug spelled without the argument —
the guard's key is the shape that HAPPENED to exist, not the defect.**

## 🟡 The guard's escape hatch is the shape the next dev will reach for

7 spellings probed against the committed detector: caught `s.stop('m',1)`, `s?.stop('m',1)`;
**MISSED** the cast `(s.stop as (m,c)=>void)('m',1)`, `s.stop!(...)`, destructured `{stop}`,
aliased `const f=s.stop`, element access `s['stop'](...)`. ⭐⭐⭐**The cast is not hypothetical — it is
what `spinner-outcome.test.ts:59` ITSELF does** (the natural way to silence the TS2554 this PR just
made visible), so the detector returns `[]` on its own file. Fix: key on the RECEIVER
(`p.spinner()`/`startSpinner()` value whose arg isn't the `{ok}` object) — closes all 7 **and**
`photon-setup.ts:811`.

## 🟡 Severity is understated for 3 of 6, OVERSTATED for 3 — rendered each sequence

⭐⭐⭐**The discriminator is whether a red marker followed ANYWAY** — reading the diff cannot tell you.

- **Already red** (`auto.ts:299`, `:434`, `:444`): all call `await fail()` → `p.log.error` (`■` RED)
  then `p.cancel` (`└` RED). Confusing, but the operator was never told it succeeded.
- **`◇` was the SOLE outcome marker** — the underslept ones:
  1. `runner.ts:335` via `auto.ts:700` (`verify`) — soft: no `fail()`, no `cancel`; only
     `p.note(…,"What's left")` whose **own header glyph is also GREEN `◇`**, then yellow `p.outro`
     ⇒ the whole failure read as two greens + a yellow.
  2. `runner.ts:335` via `skill-driver.ts:409/414` — per-step channel-install spinners; engine
     `bounce`s and **continues**. 3-step install w/ failing middle rendered `◇/◇/◇`, **no aggregate
     red anywhere** ⇒ failed step visually identical to its 2 working neighbours.
  3. `auto.ts:848` (ping timeout) — `renderPingFailureNote` is a `note()` (green header), setup
     proceeds, **no red in the sequence at all**.
- Colour verified by annotating SGR codes under `FORCE_COLOR=1` (`32`=green vs `31`=red), not assumed;
  non-TTY emits **no SGR at all**, so glyph is the only channel in CI/piped output.

## ⚠️ Adjacent PRE-EXISTING defect, worse than the one fixed — `setup/migrate-v2/tasks.ts:23`

`import { insertTask }` but `db.ts` exports **`insertTaskRow`** (TS2724, in the same 15).
**Executed**: import resolves `undefined`; calling throws `TypeError: (0 , import_db.insertTask) is
not a function`. Control: `insertTaskRow` imports as `function`, throws the deeper
`db.prepare is not a function`. Call at `:148` is on the **live v1→v2 path** (`migrate-v2.sh:347`,
step `1e-tasks`).

🔴**AND IT FAILS GREEN**: `catch` at `:165` prints `TASK_ERROR:<id>:…`, increments `failed`, exits 0
with `OK:active=13,migrated=0,skipped=0,failed=13`. `run_step`'s partial-error surfacer greps
`'^ERROR:'` which **does not match `TASK_ERROR:`** (the other 2 migrate-v2 steps use bare `ERROR:`).
Reproduced against `run_step` verbatim → `✓ Port scheduled tasks (…failed=3)` with **no error line**;
**control** (same output, `ERROR:` prefix) → `(3 error(s) reported…)`. ⇒ every scheduled task silently
dropped during migration, green check. Identical at base/head/current `nv-main`/upstream — concrete
evidence for part (b). 2-line fix (rename import; align prefix).

## 🟡 New test file is not prettier-clean — same coverage hole as the bug

`prettier --check setup/lib/spinner-outcome.test.ts` fails: 1 hunk / 7 lines (the
`ts.createSourceFile(...)` call collapses at `printWidth: 120`). Passes CI because `format:check` is
`prettier --check "src/**/*.ts"` — **the identical `src*`-only scope that hid the TS2554**.
**NOT charged**: all 3 touched sources fail `--check` at base too (controls `src/router.ts`,
`src/index.ts` clean) ⇒ `setup/` has never been formatted. *Check the base before charging a
formatting finding.*

## ⚠️ Latent: the test's glyph assertions fail under `TERM=linux`

2 of 3 assertions fail (`expected '' to be '◇'`) — clack degrades to ASCII `o`/`x` and `/[◇■▲]/`
finds nothing. GH runners set `CI=true` + unicode `TERM`, so latent not live. Fix = compare
`p.S_STEP_SUBMIT`/`S_STEP_ERROR`, **but note under ASCII `S_STEP_CANCEL === S_STEP_ERROR`** so the
cancel-vs-error assertion needs the numeric codes, not symbols. Clack's gate:
`Ze()` → `platform!=='win32' ? TERM!=='linux' : (CI||WT_SESSION||…)`.

## ✅ Composed-state merge verified, not assumed

Simulated `ci.yml`'s merge loop with `nv-dashboard` as base + nv-main's own path-guard allowlist as
`core.excludesFile`: every conflict fell **inside** nv-main's owned set (`setup/**` is owned at
`nv-main.txt`), resolved to nv-main, and **fix + guard survive into the composed tree** ⇒ no leaf
silently reverts this. CI green at head (`ci`/`check`/`label`). No `CHANGELOG-NV.md` entry —
consistent with the last 7 merges to `nv-main`, so not a gap.

## Instrument notes

- ⭐⭐**Vitest DOES run here** — `node node_modules/vitest/vitest.mjs run <file>` from a worktree with
  `node_modules` symlinked to the kb clone. **`--reporter=basic` is invalid in vitest 4.1.4**
  (`Failed to load custom Reporter from basic`) — omit it; default reporter works.
- ⛔`/workspace/extra/ephemeral` is **read-only** (`mkdir` → `Read-only file system`). Used
  `git worktree add` under `/workspace/agent/` instead; harness scripts must live INSIDE the
  worktree or node can't resolve `@clack/prompts`/`typescript` from `/tmp`.
- ⛔`git worktree` reset needed `git reset --hard <sha>` + `clean -fd` — a `checkout --`/
  `checkout-index` attempt left the tree half-restored and deleted the `node_modules` symlink
  (re-link after `clean -fd`).
- Recurring: `cd X && git …` — cwd resets between Bash calls; use `git -C $R`.
- Write path for comments: `gh api repos/.../issues/1126/comments --method POST --input <json>`
  (`gh pr review`/`gh pr comment` are denied). Built the JSON with python `json.dump` to survive
  backticks/quotes.
