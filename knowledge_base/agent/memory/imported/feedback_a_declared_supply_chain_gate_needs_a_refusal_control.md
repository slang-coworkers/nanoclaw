---
name: feedback_a_declared_supply_chain_gate_needs_a_refusal_control
description: "Reading a supply-chain gate's config never shows it fires. Only a paired refuse/allow in ONE shell does. Measured: pnpm's minimumReleaseAge is bypassed by `install -g` entirely, and by a nested config key — neither visible in the config text."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: abb6e4b0-27c4-455d-860f-ee1e995c7449
---

# A declared supply-chain gate needs a refusal control, not a config read

Measured 2026-08-06 on [[project_nanoclaw_1097_codex_one_copy]] (slang-coworkers/nanoclaw#1097),
where a PR bumped a pinned dep to a version published **14 hours** earlier against a repo policy
requiring **72 hours** plus human sign-off.

## The rule

⭐⭐⭐**A gate you can read is not a gate you have observed.** To claim a version-age / allowlist /
provenance gate applies to a given install, produce **both halves in one shell, same cwd, same
config, same spec**:

- **refuse** — the gate rejecting something it should reject (this is the *control*, and it must run
  FIRST), and
- **allow** — the real invocation under test.

If you cannot make it refuse *anything*, you have not established the gate is live, and a
"gate is satisfied" conclusion is unfounded.

## What the paired test found

pnpm 10.33.0 (the repo's own `packageManager` pin), gate configured, identical cwd and `.npmrc`:

```
local  add  <pkg>@0.146.1  → ERR_PNPM_NO_MATURE_MATCHING_VERSION
                              "released 14 hours ago … does not meet the
                               minimumReleaseAge constraint"        ← CONTROL: gate is live
install -g  <pkg>@0.146.1  → + <pkg> 0.146.1                        ← ungated
```

**Two orthogonal bypasses, neither inferable from the config text:**

1. **`pnpm install -g` is not subject to the gate at all.** The Dockerfile line under review used
   exactly that form, so the policy documented in `CLAUDE.md` and `docs/SECURITY.md` had no reach
   over the install it was cited about.
2. **The repo's config *spelling* was inert under its own pinned pnpm.** `pnpm-workspace.yaml`
   nested the key under `pnpm:`; pnpm 10.33.0 reported `config get minimumReleaseAge → undefined`
   for that shape and installed the 14 h-old version. Moved top-level it reported `4320` and held at
   the older release. ⭐⭐ **A config key that the tool parses as `undefined` reads, in review, exactly
   like an enforced policy** — and `config get` returning `undefined` is a one-command discriminator.

## Traps that cost real time here

- ⛔**An early "the gate doesn't fire" conclusion was WRONG for a boring reason: a warm store/cache.**
  Clean `--store-dir` + `--cache-dir` per run, or you measure the cache.
- ⛔**`pnpm add` mutates `pnpm-workspace.yaml`** — under pnpm 11 it silently appended a
  `minimumReleaseAgeExclude` entry for the very package under test, i.e. *the probe disabled the
  thing being probed*. Use a scratch dir and re-inspect the config after every run.
- ⛔**Exact pins do NOT bypass the gate** (an exact-version local add was refused just like a range).
  I assumed they might; the test said otherwise. Only the global-install path bypasses.
- `pnpm install -g` needs `PNPM_HOME` set **and on `PATH`**, else it errors before resolution — an
  error that looks like a result if you only grep for the success line.

## Reporting discipline

Bypass **(2)** was **pre-existing**, not caused by the PR. Said so explicitly in the published
comment. ⭐⭐ *Charging a pre-existing repo defect to the PR under review destroys the credibility of
the finding that IS the PR's* — separate them by sentence, not by implication.

## Generalization

Applies to every "policy exists therefore it holds" claim: minimum-release-age, `onlyBuiltDependencies`,
signature verification, allowlists, path guards, branch protections. Before writing *"the gate
covers this"*, ask ⭐⭐⭐**"what have I seen this gate REFUSE, today, in this shell?"** If the answer is
nothing, the finding is *"I could not verify the gate fires by method M"* — never *"the gate
applies."*

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_published_negative_env_claims_need_rederivation]],
[[feedback_a_lockfile_hash_is_a_toolchain_fingerprint]] (same PR, the other 🔴).
