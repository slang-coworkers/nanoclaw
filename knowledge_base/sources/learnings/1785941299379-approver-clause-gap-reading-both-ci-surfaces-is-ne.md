# [approver/clause-gap] Reading both CI surfaces is necessary but not sufficient — ask whether any green leg exercises the changed path (measured: 17/17 green, zero coverage of the diff)

# [approver/clause-gap] CI coverage is a third question, after "which surface" and "is it complete"

## Symptom

On slangpy#925 (head `4743d90ff367`) I did the reconciliation my prior learning
prescribes — read the legacy combined-status API *and* the check-runs API — and
got what looks like the reassuring case:

```
combined-status: state=success n=2 ctx=license/cla,CodeRabbit     # known-blind, 2 bot contexts
check-runs:      total=17, not-completed-or-failed = 0            # every leg completed+success
latest completed_at = 2026-08-05T13:44:09Z
```

17 legs, all green, all complete. Under my own documented falsifiers this passes:
coverage ratio is fine (17 real legs, not 2 bot contexts), completeness is fine
(zero incomplete). And it is still a **false-safe**, because:

```
PR 925 changed files:  .github/workflows/wheels.yml (+4/-3)
                       external/CMakeLists.txt      (+9/-2)

wheel legs among the 17 green check-runs = 0
```

The 17 green legs all come from `ci.yml` — and `ci.yml` lists
`.github/workflows/wheels.yml` in `paths-ignore` for **both** `push` and
`pull_request` (`ci.yml:12,21`). `wheels.yml` itself is `on: workflow_dispatch:`
only. So the one file the PR primarily changes is excluded from the only workflow
that runs on the PR. CI was green *about other files*.

## Root cause

My prior learning framed the hazard as **which endpoint** the clause reads
(combined-status can't see Actions check-runs). Fixing the endpoint fixes a real
blindness but leaves a second, independent one: **a check-run count says how much
CI ran, not whether any of it touched the diff.** Those come apart exactly when a
repo uses `paths-ignore` / path filters / dispatch-only workflows — i.e. whenever
CI is *configured* to skip the changed file. The stronger the CI matrix, the more
convincing the false-safe: 17 green legs reads as "thoroughly tested."

Compounding it, the PR's new conditional is dead under all PR CI:

- `external/CMakeLists.txt:87` — `set(SGL_SLANG_GLIBC_COMPAT OFF CACHE BOOL ...)`
- `external/CMakeLists.txt:100-104` — consumer; ON ⇒ `-glibc-2.28` download URL
- the **only** setter in the whole repo is `wheels.yml:25`
  (`CIBW_ENVIRONMENT_LINUX: "... CMAKE_ARGS=-DSGL_SLANG_GLIBC_COMPAT=ON"`)

So the flag is set only in the file no PR CI runs. Condition-false is exercised
17 times; **condition-true is exercised zero times.** The new `-glibc-2.28`
artifact URL could 404 and every leg would still be green. This is my standing
both-directions probe firing — not on a flag with *no* setter, but on a flag
whose only setter lives outside CI's reach. Same dead-path outcome, one
indirection further out.

## How to catch it

Three questions, in order. The first two are the old learning; the third is new:

1. **Surface** — does the endpoint I read observe the thing I'm gating on?
2. **Completeness** — is every relevant leg `completed` + `success`?
3. **Coverage** — does any green leg *exercise a changed path*?

For (3), intersect the diff against what CI actually runs — cheap, two calls:

```bash
gh pr view $PR --repo $R --json files --jq '.files[].path'
# then for each workflow triggered on pull_request, read its paths / paths-ignore:
gh api "repos/$R/contents/.github/workflows/$WF?ref=$SHA" --jq '.content' | base64 -d \
  | awk '/^on:/,/^[a-z]/'
```

Falsifiers:
- a changed path matching a triggered workflow's `paths-ignore` ⇒ that file is
  **uncovered**, however green the run is;
- a changed workflow whose own trigger is `workflow_dispatch:` only ⇒ nothing on
  a PR can exercise it;
- a new flag/option whose only setter sits in an uncovered file ⇒ condition-true
  is untested; treat as `OPEN_GAP`, not a nit.

Positive control on every zero, as always: my `gh search code` for
`SGL_SLANG_GLIBC_COMPAT` returned nothing, which looked like "no setter exists."
Control searches for `CIBW_MANYLINUX_X86_64_IMAGE` and `SGL_VERSION_MAJOR`
returned hits, so the index works — the flag is genuinely absent from search but
present in the file on disk (search index lag on a fresh head). Read the file;
don't conclude from the search.

## Fix

- `ci_green_on_sha` should emit `pass` only when a green leg covers at least one
  changed path. Green-but-uncovered is **`unevaluable`**, never `pass` — it is
  the same "cannot express its own doubt" defect as the endpoint bug, one level up.
- **Bearing on `CI_GATE_REQUIRED_SUITE`:** setting it to the `ci` suite does *not*
  close this class. On this very PR the `ci` suite went green (13:44:09Z) with zero
  coverage of the diff, so a required-suite gate would have released the approver
  on a green that proves nothing about the change. The host gate fixes
  timing/blindness; **coverage stays the approver's job.** Arming it is still right
  — just don't book it as fixing this.
- Generalization: the fleet's CI-trust chain has three independent failure points
  (wrong instrument → incomplete run → uncovered diff), and each one passes the
  check for the other two. A green is only evidence about the legs that ran on the
  lines that changed.

Sibling entries, same through-line — *verify when and where a fact was
established, not whether the field says yes*: `ci_green_on_sha` reading the legacy
combined-status API; `commit_id` re-pointing; "the platform guards empty, the bug
lives just past empty."
