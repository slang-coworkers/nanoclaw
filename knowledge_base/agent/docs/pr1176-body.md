## First: the premise this was filed under does not hold

The task was "F15 added a python lint/typecheck gate; two things were deferred —
a companion CI job on nv-main, and ~15 pre-existing ruff errors that were
suppressed." Checking before building:

- **F15 in this repo is the Discord reply-capacity fix** (#1123, #1163 — both
  merged, both on `nv-slang`). It has nothing to do with Python or linting.
- **There was no ruff gate to follow up on.** `grep -rI ruff` over the whole tree
  at `origin/nv-main` returned nothing: no `ruff.toml`, no `pyproject.toml`, no
  CI step, no suppressions. Nothing was ever suppressed, because nothing ever ran.
- **The nv-main half was already done, differently than described.** `ci.yml`'s
  trigger has listed `nv-main` since well before this change, so there is no
  missing companion job and I did not invent one.

The likely source of the description is #1133, `typecheck: widen the gate past
src/, ratcheted against a shrink-only baseline` — the TypeScript gate, which
*did* carry pre-existing errors in a baseline file. That baseline is a separate
piece of work (#1175).

What was true underneath the wrong details: **the Python side of this repo had no
linter at all.** So that is what this PR builds.

## What this does

Adds `ruff check` to `ci.yml` at a pinned `0.16.2`, with config in `ruff.toml`,
and fixes every one of the **73** findings it reported. Real count, not the ~15
in the description.

`tsc` plus `scripts/typecheck-gate.mjs` cover TypeScript. The Python tail —
the nv-path-guard matcher, the KB observability producers, the task dumper,
regression-quality, claude-trace-gc, and the supervise-issues / learnings-wiki
skill scripts — had nothing. Several run on a production cron and decide whether
the KB is reported healthy, so a silent break there does not fail a build; it
just starts publishing a wrong number.

## Two decisions worth review

**The version pin is load-bearing.** `ruff.toml` deliberately does *not* override
the rule selection, so the gate runs ruff's default set — the widest net, and one
that grows as ruff learns new checks. That is only safe against an exact version.
An unpinned linter turns CI red on an unrelated PR the day ruff ships a new rule.
Bumping the pin is how new findings arrive: as a reviewed diff, in the PR that
bumps it.

**`target-version = "py39"`, not `py311`.** Both workflows pin
`actions/setup-python` to 3.11, but that is not what this setting means.
`kb-health.py` and `kb-doctor.py` are invoked as `python3 <script>` by the prod
cron against whatever that box ships, and the skill scripts run against Debian's
`python3` in the agent container. At `py311` ruff asks for `datetime.UTC`
(UP017, nine sites across kb-health / kb-doctor / regression-quality) — an alias
that **does not exist before 3.11**. Taking that advice would lint the daily KB
metrics into an `AttributeError` on any box still on 3.10. The floor stays where
it can be justified without a guess; raising it needs the prod interpreter
verified first, in its own PR.

## The 73, by disposition

| Count | Rule(s) | Disposition |
|------:|---------|-------------|
| 18 | I001, FURB167, UP035, UP037 | ruff's own safe autofixes — split/sorted import blocks, `re.S`→`re.DOTALL`, `re.I`→`re.IGNORECASE` |
| 14 | EXE001 | `chmod +x` — files carried a shebang without the mode bit, matching `scan.py`/`test_scan.py` which already had it |
| 7 | PLW1510 | explicit `check=False` |
| 13 | BLE001 | 8 narrowed, 5 kept broad with a reason |
| 3 | SIM115 | 2 real leaks fixed, 1 noqa |
| 18 | C401, ISC004, RUF012, RUF015, RUF059, SIM117, SIM118, PYI034, S102, S112, TRY004 | fixed, except 3 noqa'd (below) |

**PLW1510** — every one of these sites inspects `returncode` itself, so
`check=False` spells out today's behaviour rather than changing it.

**BLE001, the eight narrowed** to the raise set the block can actually produce:
`json.JSONDecodeError` where the input is a `str` from `text=True`,
`(OSError, subprocess.SubprocessError)` around `subprocess.run`,
`(OSError, ValueError, KeyError, TypeError)` around the snapshot read. Narrowing
inside kb-doctor's checks is safe because the per-check net in `main()` still
converts anything unexpected to UNKNOWN.

**BLE001, the five kept broad**, each with a `# noqa: BLE001` naming why:

| Site | Why breadth is the guarantee |
|------|------------------------------|
| `kb-doctor.py` per-check net in `main()` | F09's fail-closed net — every crash in any check must become UNKNOWN, never a report claiming everything was verified |
| `kb-doctor.py` `volatile_fields()` | `exec_module` runs arbitrary module-level code; the raise set is whatever the imported module can raise |
| `dump-scheduled-tasks.py` stage handler | F18's last-resort rollback; any escape leaves a half-replaced snapshot, the torn publish this script exists to prevent |
| `learnings-wiki` `assert_refused_and_preserved` | the assertion *is* "refused for ANY reason"; naming types lets a new failure mode read as a clean build |
| `kb-health.py` history read | narrowed to `(OSError, ValueError)`, which covers all three reachable cases — listed here because it is the one TRY004 also touches |

**The three remaining noqa**: `S102` ×2 (the supervise-issues tests `exec` source
extracted from `pull-universe.sh` — the function under test has no importable
form, so this tests the real thing instead of a copy that can drift); `SIM115` ×1
(the handle is closed by a `with` on the next line — guarding only the `open()` is
deliberate, so a mid-file read error stays loud); `TRY004` ×1 (ruff wants
`TypeError`; `ValueError` is deliberate because this describes a corrupt file, not
argument validation, and must land in the same handler as the `JSONDecodeError`
that means the same thing).

`RUF100` (unused-noqa) is in the default set, so every suppression above is one
CI has confirmed is still doing work. Two noqa I wrote during this pass were
rejected by it and removed.

## A bug the work surfaced

Adding `check=False` to `regression-quality.py` broke `FakeGh`, the test double,
whose `__call__` did not accept that kwarg — and the blind `except Exception`
directly below **swallowed the resulting `TypeError` and reported it as a GitHub
fetch failure**, withholding every metric. A broken test double read as an
outage. That is exactly the bug class BLE001 names. Fixed the double; the
narrowed except now makes that failure loud instead of plausible.

## Verification

Run locally on the composed branch:

```
$ ruff --version
ruff 0.16.2
$ ruff check .
All checks passed!
```

All six Python suites, before and after — 173 tests, no change in outcome:

```
exit=0 Ran 31 tests OK  container/skills/learnings-wiki/test_learnings_wiki.py
exit=0 Ran 41 tests OK  scripts/test_kb_observability.py
exit=0 Ran 27 tests OK  scripts/test_regression_quality.py
exit=0 Ran 33 tests OK  container/skills/supervise-issues/scripts/test_scan.py
exit=0 Ran 13 tests OK  container/skills/supervise-issues/scripts/test_pull_universe.py
exit=0 Ran 28 tests OK  container/skills/supervise-issues/scripts/test_worktree_gc.py
```

Path-guard, against this commit:

```
$ python3 .github/nv-path-guard/check.py nv-main $(git rev-parse HEAD)
ok: all 19 changed file(s) match nv-main's allowlist.
```

`ruff.toml` is added to `.github/nv-path-guard/nv-main.txt` — same owner as the
workflow that runs it, on the `tsconfig.typecheck.json` precedent. A lint config
that could diverge from the job invoking it is worse than no config.

`ownership.py`'s `__enter__` now returns `Self` under a `TYPE_CHECKING` guard.
`from __future__ import annotations` is already in force there, so the annotation
is never evaluated and the file stays importable on any interpreter; verified by
running the matcher through both its CLI path and its context-manager path.
