## Post-merge review — merged 13:58:39Z, ~4 min after opening

This is a review of the **merged** tree, not a gate. All four blobs at `nv-main` tip equal the reviewed head `19479a29` **by hash** (`ac53278ef` / `96097c52e` / `3b328af89` / `0722be9f0`), re-verified after two later merges landed. Verdict: **the fix is correct, the diagnosis is exact, and the guard is genuinely non-vacuous.** Everything below is either a confirmation with the measurement behind it, or a non-blocking follow-up.

### ✅ Every empirical claim in the body reproduces

Ran clack 1.2.0 from this tree's own `node_modules`, capturing `process.stdout.write`:

| call | glyph | note |
|---|---|---|
| `stop(msg, 1)` | `◇` | **byte-identical** to `stop(msg)` — confirmed by string equality on the full captured output, not just the glyph |
| `stop(msg)` | `◇` | |
| `cancel(msg)` | `■` | red |
| `error(msg)` | `▲` | red |

The minified source agrees: `stop:(_="")=>W(_,0)` — the `0` is a literal at the call, so the second argument is dropped by arity. `error`/`cancel` reach `W(_,2)`/`W(_,1)`, and `W` picks the glyph from that code alone.

**`error` over `cancel` is right, and for a stronger reason than the semantic one you gave.** I checked whether the two differ in anything beyond colour: `isCancelled` stays `false` and the `onCancel` callback does **not** fire for either — so the choice is purely presentational and the semantic argument is the only one available. Take it. (Under `TERM=linux` both degrade to the same ASCII `x`, so on a Linux VC the two are indistinguishable anyway — one more reason not to spend the distinction on the wrong one.)

**The `tsc` figures reproduce as a delta, and the absolute numbers differ from yours by exactly 3 in both directions** — mine were 21→15, yours 18→12. The gap is three `TS2307`s (`js-yaml` ×2, `@chat-adapter/telegram` ×1) from my tree's partial `node_modules`; both are real `package.json` deps that a full install resolves. **`TS2554` went 6 → 0**, and the six line numbers are exactly the six sites you list. Same delta, different environment — your numbers are the ones to quote.

### ✅ The guard is non-vacuous — verified by running it against the base, not by reading it

Restored the three source files to `f03cff946` and re-ran the committed test:

```
× setup/ and src/ are free of `.stop(msg, <code>)`
AssertionError: expected [ 'setup/auto.ts:299', …(5) ] to deeply equal []
+   "setup/auto.ts:299", "setup/auto.ts:434", "setup/auto.ts:444",
+   "setup/auto.ts:848", "setup/lib/runner.ts:335", "setup/lib/tz-from-claude.ts:65"
```

Exactly the six, then 3/3 pass again at head. The AST-over-grep choice is load-bearing and I confirmed it: `tz-from-claude.ts`'s `1` sat on line 69 with the `.stop(` on line 65 — four lines apart, invisible to any line-wise pattern.

**The bug is also live upstream, which is worth saying in the body.** `setup/lib/runner.ts` at `nanocoai/nanoclaw@743e32df4` is blob `0e4afef08` — **identical to this fork's base** — and upstream `setup/auto.ts:284/419/429/828` and `tz-from-claude.ts:65` carry all six. `setup/lib/spinner-outcome.test.ts` is absent upstream. This is a fork-only fix for an upstream defect; an upstream PR would land it for everyone.

### 🔴 One site with the same bug was missed — `scripts/photon-setup.ts:811`

```ts
} catch (err) {
  spin.stop('Login failed');        // ← renders ◇ GREEN
  p.cancel(err instanceof Error ? err.message : String(err));
```

Rendered:

```
◇  Login failed          ← {GREEN}
└  device code expired   ← {RED}
```

It doesn't pass a `1`, so **the committed guard cannot see it** — I ran the PR's own `overArgumentedStopCalls` against the file and got `[]`. It's also outside the `['setup','src']` walk, so widening the detector alone wouldn't catch it either. An AST census of all 31 `.stop(...)` call sites repo-wide finds exactly **one** failure-worded single-arg `stop` (this one; `photon-setup.ts:815 'Logged in'` is the success control on the adjacent line). One-line fix: `spin.error('Login failed')`.

### 🟡 The guard's own escape hatch is the shape a future dev will reach for

Probed seven spellings against the committed detector:

| shape | caught? |
|---|---|
| `s.stop('m', 1)` | ✅ |
| `s?.stop('m', 1)` | ✅ |
| `(s.stop as (m,c)=>void)('m', 1)` | ❌ |
| `s.stop!('m', 1)` | ❌ |
| `const {stop}=s; stop('m',1)` | ❌ |
| `const f=s.stop; f('m',1)` | ❌ |
| `s['stop']('m', 1)` | ❌ |

The cast is not hypothetical — **it is what `spinner-outcome.test.ts:59` itself does**, because it is the natural way to silence the `TS2554` this PR just made visible. So the detector returns `[]` on its own file. Not a defect in the fix (the caught shape is the one that existed), but the next occurrence is likelier to be a cast than a bare `1`. Matching on the *receiver* rather than argument count — flag any `.stop(` on a value from `p.spinner()`/`startSpinner()` whose argument isn't the `{ok}` object — would close all seven, and would also catch `photon-setup.ts:811`.

### 🟡 The user-visible severity is understated for three of the six, and overstated for three

I rendered each site's full surrounding sequence. The distinction is whether a red marker followed anyway:

**Already had a red marker (the `◇` was misleading but not the only signal)** — `auto.ts:299`, `:434`, `:444`. All three call `await fail()` immediately, which emits `p.log.error` (`■` red) then `p.cancel` (`└` red). So:

```
◇  Couldn't reach OneCLI at https://x.    ← the bug
■  Couldn't reach OneCLI at https://x.    ← fail()'s log.error, RED
└  Setup aborted.                         ← RED
```

Confusing, worth fixing, but the operator was not told the run succeeded.

**The `◇` really was the only outcome marker** — and these are the ones the body undersells:

1. **`runner.ts:335` reached via `auto.ts:700` (`verify`)** — soft failure: no `fail()`, no `p.cancel`. The only follow-up is `p.note(…, "What's left")`, whose own header glyph is **also a green `◇`**, and then `p.outro` in yellow. So the entire failure read as two greens and a yellow.
2. **`runner.ts:335` reached via `skill-driver.ts:409/414`** — per-step spinners during a channel install, where the engine `bounce`s and **continues**. A three-step install with a failing middle step rendered `◇ / ◇ / ◇`; there is no aggregate red anywhere, so a failed step was visually identical to its two neighbours that worked.
3. **`auto.ts:848` (ping timeout)** — `renderPingFailureNote` is a `note()` (green `◇` header) and setup proceeds. No red marker in the sequence at all.

Two more non-fatal `runQuietStep` callers sit on the same path (`auto.ts:1301` auth, `run-channel-skill.ts:57` wire) — both check `.ok` and call `fail`, so they're in the first group. Recommend the body lead with the three cases where the glyph was the *sole* signal; they're the ones that could have caused a real misread.

### 🟡 The new test file is not prettier-clean, and the reason is the same coverage hole as the bug

`prettier --check setup/lib/spinner-outcome.test.ts` fails — one hunk, 7 lines: the `ts.createSourceFile(...)` call would collapse to one line at the repo's `printWidth: 120`. It passes CI because `format:check` is `prettier --check "src/**/*.ts"` — the identical `src*`-only scope that hid the `TS2554`. **Not charged as a regression:** all three touched source files fail `--check` at the base too (control: `src/router.ts`, `src/index.ts` are clean), so `setup/` has never been formatted. But a new file added in the PR that documents this coverage hole is a good moment to land clean.

### ⚠️ Adjacent, pre-existing, and worse than this bug — `setup/migrate-v2/tasks.ts:23`

Not this PR's, but it's the other diagnostic in the same 15 and I'd rather it not sit unreported:

```ts
import { insertTask } from '../../src/modules/scheduling/db.js';   // TS2724
```

`db.ts` exports **`insertTaskRow`**, not `insertTask`. Executed it: the import resolves to `undefined`, and calling it throws `TypeError: (0 , import_db.insertTask) is not a function` (control: `insertTaskRow` imports as `function` and throws a deeper `db.prepare is not a function`). The call at `:148` is on the live v1→v2 path — `migrate-v2.sh:347` runs it as step `1e-tasks`.

**And it fails green.** The `catch` at `:165` prints `TASK_ERROR:<id>:…` and increments `failed`, then exits 0 with `OK:active=13,migrated=0,skipped=0,failed=13`. `run_step`'s partial-error surfacer greps `'^ERROR:'` — which **does not match `TASK_ERROR:`** (the other two migrate-v2 steps use the bare `ERROR:` prefix). Reproduced against `run_step` verbatim:

```
  ✓ Port scheduled tasks (OK:active=3,migrated=0,skipped=0,failed=3)

CONTROL, same output with the ERROR: prefix:
  ✓ Port scheduled tasks (OK:active=3,migrated=0,skipped=0,failed=3)
  (3 error(s) reported — see …/1e-ctl.log)
```

So **every scheduled task is silently dropped during migration** and the operator gets a green check. Present identically at base, at head, at current `nv-main`, and upstream `743e32df4` — squarely part (b)'s territory, and concrete evidence for it: this is what the missing `setup/**` typecheck costs. Two-line fix (rename the import; align the prefix to `ERROR:`).

### Housekeeping

- CI green at head: `ci` / `check` / `label` all SUCCESS.
- Simulated `ci.yml`'s composed merge with `nv-dashboard` as base: all conflicts fell inside nv-main's owned set (`setup/**` is owned), resolved to nv-main, **and the fix plus the guard survive into the composed tree** — no leaf will silently revert this.
- `TERM=linux` caveat on the test itself: two of the three assertions fail there (`expected '' to be '◇'`), because clack degrades to ASCII `o`/`x` and the `/[◇■▲]/` matcher finds nothing. GitHub runners set `CI=true` with a unicode-capable `TERM`, so this is latent, not live — but a `p.S_STEP_SUBMIT`/`S_STEP_ERROR` comparison instead of hard-coded glyphs would make it environment-independent. Note that under ASCII, `S_STEP_CANCEL === S_STEP_ERROR`, so the `cancel`-vs-`error` assertion needs the codes, not the symbols.
- No `CHANGELOG-NV.md` entry — consistent with the last 7 merges to `nv-main`, so not a gap.
