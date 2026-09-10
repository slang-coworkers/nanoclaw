---
name: project_nanoclaw_1118_release_age_back_in_force
description: "slang-coworkers/nanoclaw#1118 F01 fix (my own #1097 finding) — every body claim verified incl. a 2x2 npmrc-scope matrix; 1 real defect: the CI gate's probe fixture has no packageManager so a corepack shim probes pnpm 11.20.0 while reporting 10.33.0. One-line fix tested."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1118
---

**slang-coworkers/nanoclaw#1118** — `supply-chain: put the release-age policy back in force, pin
Codex through the manifest (F01)`, author **`szihs`** (human), base **`nv-main`**, branch
`fix/f01-supply-chain`. Fixes **F01 — a finding I published myself** on
[[project_nanoclaw_1097_codex_one_copy]], so I held the prior measurements and could check the fix
against them rather than re-deriving from the body.

**ROUTING: handled INLINE by Main — ~29th instance** ([[project_nanoclaw_pr874_webhook_route_approver]]).
Webhook carried the generic *"Route it to the project's *-pr-approver"* string; standing rule
overrides (NanoClaw platform-infra fork, no `nanoclaw-pr-approver` exists; slang/slangpy approvers
are repo-scoped ⇒ `ABSTAIN_POLICY`).

Heads: `de18a7e78` at first read → **`123f0c513`** after a `synchronize` mid-review. The delta was
**one commit, +7 lines** on `.github/nv-path-guard/nv-main.txt` (adds `pnpm-workspace.yaml` +
`.npmrc` to nv-main's owned set). ⭐**Re-fetched instead of carrying the verdict across the
synchronize** — and it mattered structurally: `ci.yml` reads that same allowlist via
`git show HEAD:.github/nv-path-guard/nv-main.txt` with `OWNED_SRC=HEAD` for an nv-main PR, so the
PR's own allowlist edit applies to itself. Without the entry, a sibling overlay's stale
`pnpm-workspace.yaml` conflict would land outside the owned set and fail the composed merge.
9 files, **+190/−2012**. Base moved 10 commits during review; **zero overlap** in touched files.
`ci` + `check` both green.

## Verdict: sound. One real defect, cosmetic-but-load-bearing; no blocker.

Every factual claim in the body verified independently. Notably the author's *own* honesty items hold
up under test — rare enough to say so.

### The paired matrix (pnpm 10.33.0, pinned via fixture `packageManager`, controls first)

| config location | local `add` | `install -g` |
|---|---|---|
| top-level `minimumReleaseAge` (the fix) | **REFUSED** | — |
| nested under `pnpm:` (pre-fix) | installed, no warning | — |
| `.npmrc` `minimum-release-age` (repo-level) | **REFUSED** | **installed — UNGATED** |
| `.npmrc` `minReleaseAge` (npm 11's key) | installed | — |
| `.npmrc` `minimum-release-age` at **HOME** | — | **REFUSED** |
| neither | installed | installed |

⇒ confirms all four config-key claims **and** the author's flagged item 2: the repo `.npmrc` does
**not** reach `install -g`; only a HOME-level key does. Also confirmed structurally — the repo-root
`.npmrc` is **never `COPY`'d** into either Dockerfile (`COPY` set is `cli-tools.json`,
`install-cli-tools.sh`, `codex-hooks.toml`, `agent-runner/*`, `entrypoint.sh`), and
`install-cli-tools.sh:20` writes `/root/.npmrc` itself. So the new `.npmrc` line is honest
defense-in-depth for host invocations, not image coverage.

### The gate script does refuse — verified both directions

- On PR head: RC=0, all three parts pass.
- **Against the pre-fix `pnpm-workspace.yaml`** (checked out from `origin/nv-main` over the
  worktree): **RC=1**, `minimumReleaseAge is INDENTED … Move it to column 0`. ⭐This is the
  discriminating run — a gate that only ever passes is [[feedback_a_declared_supply_chain_gate_needs_a_refusal_control]]'s
  exact failure mode, and this one demonstrably fails on the bug it exists to catch.
- Real CI log (job 92634957633, step 7 ran **before** the install as designed): all three lines
  present.

### 🟡 The one defect — the probe reports a pnpm version it did not use

`scripts/check-release-age-policy.sh` prints `pnpm --version` from the repo root (**10.33.0**, via
`packageManager`) and its final line claims *"verified against pnpm 10.33.0"*. But the probe fixture
it writes is `{"name":"release-age-probe","version":"1.0.0","private":true}` — **no
`packageManager`** — and where `pnpm` is a **corepack shim** the version resolves **per-cwd**.

Instrumented the real script (added `pnpm --version` inside the probe subshell, no other change):

```
reported by the script (repo root) : 10.33.0
actually used inside BOTH probes   : 11.20.0
```

So on a corepack install the script's conclusion is attributed to a pnpm that never ran the probe.
The verdict is unaffected today — I ran the same matrix with the fixture pinned and every outcome is
identical, and CI uses `pnpm/action-setup@v4` (`standalone: false` → a real 10.33.0 binary at
`~/setup-pnpm`, not a shim), so **CI is measuring the right pnpm**. The defect bites the
run-it-locally path and, more importantly, the script's whole purpose is *"don't trust a claim you
haven't made the tool demonstrate."* A provenance line that can silently name the wrong tool is that
same bug one level up.

**Tested one-line fix** — add `packageManager` to the fixture; both probes then report 10.33.0 and
all three parts still pass:
```
printf '{"name":"release-age-probe","version":"1.0.0","private":true,"packageManager":"pnpm@10.33.0"}\n'
```
(better: interpolate the root's own resolved version so it can't drift.)

### ✅ Other claims spot-checked, all correct

- `@openai/codex@0.146.1` `scripts` is **empty** (control: `better-sqlite3` prints a full set) ⇒
  omitting `onlyBuilt` preserves install behavior exactly, as claimed.
- **Zero** `CODEX_VERSION` refs remain on head (base had 4, two per Dockerfile).
- `container/build-derived.sh:96` `REQUIRED_BINS` does contain `codex` ⇒ the manifest move is
  covered by an existing acceptance check.
- `typescript@5.9.3` is genuinely in `pnpm-lock.yaml` ⇒ probe adds nothing to the trust surface.
- Deleted `container/agent-runner/package-lock.json`: not in any Dockerfile `COPY` set; only refs are
  the two `git checkout --theirs … 2>/dev/null` lines in `add-coworkers`/`add-dashboard` skills,
  which tolerate absence; `.gitignore:68-69` bans it *citing this very gate*.
- **Every SKILL.md pre-flight marker correction is right** — verified file-by-file on head:
  `codex-agents-md.ts`, `setup/providers/codex.ts`, `container/AGENTS.md`, `exchange-archive.ts` all
  **ABSENT**; `setup/providers/index.ts` present but **0** codex refs. The old list would have
  reported a working install as broken.

### ⚠️ Time-sensitive: the pin is still under-age *right now*

`0.146.1` published `2026-08-05T16:00:31Z` = **21.9 h** old at review (2026-08-06T13:52Z); matures
**2026-08-08T16:00Z**. `0.146.0` = 204 h, mature. Tested the author's own proposed remedy by
simulating `install-cli-tools.sh` writing `minimum-release-age=4320` into `/root/.npmrc` beside the
`only-built-dependencies[]=` opt-ins it already writes:

| pin | with the gate in `/root/.npmrc` |
|---|---|
| 0.146.1 (current) | **REFUSED** — image build would fail today ⇒ author's reason for deferring is **correct** |
| 0.146.0 (option 2) | **INSTALLED** — option 2 works today with the gate ON |

⇒ recommended: **option 2** (pin back to 0.146.0 + enable the HOME-level gate) — it closes the
actual hole now instead of waiting on a clock, and needs no `minimumReleaseAgeExclude` (which
`CLAUDE.md:284-287` forbids without sign-off). Option "wait until 08-08" leaves the gate off for two
days and depends on someone remembering.

## Instrument traps hit here

- ⛔**First `install -g` probe used `is-odd@3.0.1` (years old) against the real 4320-min window —
  it passes the gate regardless, so it discriminated NOTHING** and I briefly read `RC=0` as "ungated".
  Re-ran with a ~190-year window to force refusal, control first. ⭐*A negative result from a probe
  that cannot produce a positive is not evidence.*
- ⛔**The corepack per-cwd version resolution nearly fooled me the same way it fooled the script**:
  my own first `.npmrc` fixture had no `packageManager` and silently ran pnpm **11.20.0**. Caught it
  only because the output footer printed `using pnpm v11.20.0`. ⇒ **print the tool version from
  inside the fixture, never from the caller's cwd.**
- Every probe isolated `npm_config_userconfig`/`globalconfig` and set `HOME` explicitly; the
  repo-vs-HOME distinction is invisible otherwise.

**Comment posted**: `5205723636` via
`gh api repos/slang-coworkers/nanoclaw/issues/1118/comments -X POST -F body=@file`
(https://github.com/slang-coworkers/nanoclaw/pull/1118#issuecomment-5205723636).

**RESUME** = szihs replies, or head moves off `123f0c513`. If it moves, **re-fetch and re-measure —
do not carry this verdict across a `synchronize`** (it already moved once mid-review). If merged
as-is, the 🟡 fixture fix and the option-2 decision are the two open follow-ups; the maturity clock
on `0.146.1` expires **2026-08-08T16:00Z**, after which "wait" and "option 2" converge.
