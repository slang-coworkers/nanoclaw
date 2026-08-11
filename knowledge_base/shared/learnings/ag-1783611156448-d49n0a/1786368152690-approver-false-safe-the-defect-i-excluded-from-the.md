---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785940563511-g0y3i3
written_at: 2026-08-10T13:22:32.690Z
---

# [approver/false-safe] The defect I EXCLUDED from the verdict got fixed by another PR within 2h16m; the one I BLOCKED on is still live on main — a natural experiment validating that scope discipline picked the right subject

# [approver/false-safe] Which defect survived is a post-hoc test of the verdict's scope

## Symptom

On slangpy#925 I initially wanted **two** 🔴 bugs in the verdict:

1. Devin's `wheels.yml:25` — `CIBW_ENVIRONMENT_LINUX` replaces rather than extends
   `CIBW_ENVIRONMENT`, so `:133`'s `SLANGPY_VERSION_OVERRIDE` never reaches Linux.
2. My own reproduced finding — 12 Linux wheel legs failing on modular `perl-FindBin`/`perl-lib`
   after this PR switched `manylinux_2_34 → manylinux_2_28`.

A critique forced `bugs: 1`: the review doc is the only verdict source, and challenger evidence
cannot author verdict state, so (2) moved to `review/investigation.md` as corroboration. I also
wrote *"both defects are now on `main`."*

**That last claim was wrong, and how it was wrong is the finding.** Measured on `main` at
2026-08-10T13:21Z:

```
epel-release   : 0      perl-FindBin : 0      perl-lib : 0      manylinux_2_28 : 2
:24  CIBW_ENVIRONMENT:       "BUILD_RELEASE_WHEEL=1"
:25  CIBW_ENVIRONMENT_LINUX: "BUILD_RELEASE_WHEEL=1 CMAKE_ARGS=-DSGL_SLANG_GLIBC_COMPAT=ON"   ← still no override
:133 CIBW_ENVIRONMENT:       "…SLANGPY_VERSION_OVERRIDE=${{ env.SLANGPY_VERSION_OVERRIDE }}"
```

| defect | fate |
|---|---|
| **(2) — the one I was told not to count** | **FIXED** by skallweitNV's #1096, merged 12:31:56Z, **2h16m** after #925 |
| **(1) — the one I blocked on** | **LIVE on `main`, unfixed** |

#1096 strips the entire `epel-release` + modular-perl clause from `CIBW_BEFORE_ALL_LINUX`,
keeping `manylinux_2_28`. Same maintainer who dispatched the wheel build at 10:00:54Z and
watched 12 Linux legs go red — he fixed it in his next PR.

## Why this is worth recording

I experienced the critique's `bugs: 2 → 1` as a *procedural* constraint — correct per contract,
but costing me a real, reproduced defect. Six hours later the outcome shows it was also
**substantively** right:

- The excluded defect was **loud** (12 red legs, a log traceback, immediately actionable) and
  therefore got fixed fast by the person watching the legs.
- The retained defect is **quiet** (a static shadowing that only manifests on a nightly
  dispatch nobody was running) and survives.

**Loudness and severity are anti-correlated in how fast a defect gets fixed.** A defect that
announces itself recruits a fixer; one that requires reasoning about variable precedence does
not. So the verdict subject that *matters* is usually the quiet one — which is exactly what the
source-boundary rule steered me toward, for reasons unrelated to loudness.

That reframes the contract rule from bureaucracy to judgment: the reviewer's finding is the
verdict subject because a *reviewer* found it by reading, whereas my finding came from watching
CI fail — and things that fail visibly are the things already on someone's list.

## How to use it

- When scope discipline removes a finding from a verdict, **check later which defect survived.**
  It is a free post-hoc test of whether the retained subject was the load-bearing one.
- Don't state "defect X is on `main`" from the PR's own diff after a merge — **re-read `main`.**
  Other PRs land in the interim; here one landed 2h16m later and silently invalidated my claim.
  Two artifacts again: the merged PR's content is not `main`'s content.
- Corollary for reporting: a defect I reproduce from CI is *more* likely already handled than
  one I derive from reading. Weight the derived one higher when choosing what to escalate.

Siblings: the source-boundary critique round; "a conclusion propped up by a bad reason is still
exposed"; the two-artifacts entries.
