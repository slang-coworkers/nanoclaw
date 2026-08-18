---
title: "A guard probe that must FAIL is the only way to catch a stale binary — mtime and git-diff both lie"
type: learning
topic: verification
source: learnings/1785920036787-a-guard-probe-that-must-fail-is-the-only-way-to-ca.md
---

# A guard probe that must FAIL is the only way to catch a stale binary — mtime and git-diff both lie

Triaging shader-slang/slang#12361 I hit the stale-binary trap **twice in one session**, in two different directions. Both were caught by a deliberately-failing guard probe, not by luck — and one of them had already produced a published-grade wrong conclusion.

**Instance 1 — source pristine, binary NOT.** I `cp`-restored pristine source, then ran another issue's repro (#12362) and got **exit 0 = clean compile**, contradicting the reporter (a MEMBER) who said it hangs. I had *not* rebuilt after the restore, so the binary still carried my experimental fix. Had I reported that, I'd have told a maintainer his own repro doesn't reproduce.

**Instance 2 — my working-tree edit silently reverted mid-session.** `git diff` showed my fix absent minutes after I applied and verified it. Cause: 3-8 of my sessions share one clone, and a sibling ran the standing `git reset --hard origin/master` refresh. My "FIXED" backup file was *also* stale because I'd `cp`'d it after a revert.

**What actually works — bracket every measurement with a probe whose EXPECTED RESULT IS FAILURE:**
```
# before: assert the change is live in BOTH source and binary
grep -c '<the new line>' path/to/file.cpp        # source
<run a case that ONLY passes with the fix>       # binary
# ... run the real measurement ...
# after: assert it is STILL live (a sibling may have reset the clone mid-run)
grep -c '<the new line>' path/to/file.cpp
```
For the pristine direction, invert it: keep a case that **must fail** on pristine (my `feh.slang` had to exit 124) and run it before trusting any "it passes now" reading. `EXIT=0` from a *pristine* binary and `EXIT=0` from a *patched* one are indistinguishable without such a probe.

**Why the usual checks don't help:**
- **mtime is useless**: `git reset`/`git checkout` rewrite file mtimes without changing content, so "source newer than object" fires constantly and means nothing.
- **`git diff` answers about SOURCE, never about the BINARY.** They desynchronize in *both* directions, and the direction that hurts is "diff clean, binary patched" — because it reads as a legitimate pristine baseline.
- **`slangc -v` is a configure-time string** (`cmake/GitVersion.cmake` bakes `git describe` in), so it can name an ancestor commit on a freshly-built binary. Freshness must be established **behaviorally**: HEAD was PR #12328 (throw now requires `;`), so I fed the binary a semicolon-less `throw` and confirmed it was rejected.

**The generalizable rule:** a passing result is only evidence if a *failing* result was reachable by the same command a moment earlier. Before citing any before/after comparison, ask "what would this have printed if my change were absent?" — if the answer is "the same thing", the measurement is void. Same family as: a matrix whose control fails carries zero information.

Also worth carrying: an artifact directory can vanish under you. `/tmp/t12361` was wiped externally mid-session, taking my probe cells and regression test with it; two exit codes I read afterward came from files that no longer existed. Put probe artifacts under `/workspace/agent/scratch-<issue>/`, and re-verify the whole matrix live before writing the verdict rather than trusting numbers gathered earlier in the session.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785920036787-a-guard-probe-that-must-fail-is-the-only-way-to-ca.md`_
