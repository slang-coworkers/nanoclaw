---
title: "A 0-of-N test result with clean compiles means the tool never ran — attribute it to the runner, not the PR"
type: learning
topic: ci-tooling
source: learnings/1785831962573-a-0-of-n-test-result-with-clean-compiles-means-the.md
---

# A 0-of-N test result with clean compiles means the tool never ran — attribute it to the runner, not the PR

## The signature

Slang CI's `test-compile-regression` job reported this on runner **SLANGWIN5** (2026-08-04):

```
PASSING [ 866 / 866 ]                       <- every shader COMPILES fine
PASSING spirv-val [ 0 / 866 ]               <- validator scores ZERO
PASSING Non-Semantic Info [ 866 / 866 ]
PASSING Non-Semantic Info spirv-val [ 0 / 866 ]
##[error]Process completed with exit code 255.
```

1732 `- FAIL` lines. It reads like a catastrophic codegen regression. It was a broken `spirv-val`
on one runner.

**The tell: a 0-of-N wipeout in BOTH validation modes, with zero diagnostic text, while compiles
sit at 100%.** 866 genuinely-invalid shaders would each emit a validator error message — and
wouldn't have compiled cleanly in the first place. All-zero + silence is a tool that never
executed. A *partial* score (say 812/866) is the shape of real breakage; a clean 0 is the shape of
a missing binary.

## Generalizable recipe — is this red the PR's fault or the runner's?

Five cheap checks, no log-spelunking needed. Any one can settle it:

1. **Does the diff even reach the failing job?** The PR touched only
   `tools/slang-test/slang-test-main.cpp` (+17/−2). That job runs `slangc` via
   `compile_all_slang.sh` and never invokes `slang-test` at all ⇒ the PR *cannot* be the cause.
   Do this first — it's one `pulls/N/files` call and it's often decisive.
2. **Same job, other runners, same window?** Green elsewhere ⇒ runner-scoped.
3. **Same runner, earlier?** SLANGWIN5 was `866/866` at 2026-08-03T18:27Z ⇒ there's an *onset*.
   That reframes the hunt: look for what changed on the box, not in the tree.
4. **Sibling breadth.** 34/35 jobs green including every GPU test ⇒ not a code regression.
5. **A second PR with the identical signature on the same runner** ⇒ promotes "single-PR flake"
   to "runner defect". This is the one that converts a hypothesis into a finding.

Result here: SLANGWIN5 green through 20:48:54Z, then FAIL at 00:48:47Z and 07:18:45Z (2/2);
SLANGWIN4 and SLANGWIN10X64-1 100% green across the same window including four SLANGWIN4 runs
*after* the onset. Two different branches (`#12322`, `fix/issue-12333`) hit it.

## Why this matters operationally

**The obvious remedy is the wrong one.** "CI red, looks flaky, rerun it" reland on the same bad
runner, and each attempt burns a rerun-cap slot while changing nothing. The correct action is to
withhold the rerun and escalate for reprovisioning — and to say *why* reruns are futile, or a
maintainer will just press the button themselves.

Corollary for cap bookkeeping: when you *decline* to act, still record the decision, but do not
increment the cap counter. A withheld rerun should leave the budget intact for a real flake later
in the day.

## Bonus: don't let a plausible-looking classification skip verification

A subagent classified a different PR's build failure as legitimate; checking at HEAD showed it was
a stale-`workflow_dispatch` phantom (green `pull_request` suite at the same still-current head,
with that exact build job explicitly `success`). Its log had expired, so the "legitimate" read was
inference. **Currency can settle a red even when the log is gone** — you don't always need the
signature to know the verdict.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785831962573-a-0-of-n-test-result-with-clean-compiles-means-the.md`_
