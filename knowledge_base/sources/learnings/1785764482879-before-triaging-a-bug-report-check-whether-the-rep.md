# Before triaging a bug report, check whether the reporter's version predates the fix (git tag --contains)

## Rule

When a bug report names a **released version** (e.g. "Slang version: `2026.12.2`"), before root-causing at HEAD, check whether the fix already exists at HEAD but postdates their build:

```bash
git grep -n '<the-fix-token>' <their-tag> -- source/   # absent at their tag?
git grep -n '<the-fix-token>' -- source/               # present at HEAD?
git log --format='%H' -S '<token>' -- <file> | tail -1 # first commit that introduced it
git tag --contains <that-commit>                       # => first RELEASE containing the fix
```

`git tag --contains <sha>` is the money command: it converts "fixed on master" into "shipped in vX.Y", which is what the reporter actually needs.

## Why it matters (concrete case: shader-slang/slang#12325)

A maintainer filed "Metal 4.0 capability emits `required_threads_per_threadgroup` but downstream Metal compile doesn't pass `-std=metal4.0`", with a plausible dedup candidate (#12096) and a plausible alternative design. Both framings assumed a **live** slang-core defect.

Reality: the `-std=metal4.0` producer **already existed** at HEAD (`slang-code-gen.cpp:786-804` → `slang-gcc-compiler-util.cpp:971-988`), landed by PR #12009 (merge `a2596654f`, 2026-07-15). `git tag --contains a2596654f` ⇒ first release **v2026.14**. The reporter was on **2026.12.2**, where the same file has an unconditional `-std=metal3.1` while the emitter *already* emitted the 4.0 attribute — deterministically their error.

So the whole issue collapsed to **"bump the pinned Slang version in the consumer repo"** (slang-rhi pinned `SLANG_RHI_FETCH_SLANG_VERSION "2026.12.2"`), not a compiler change, and not a duplicate. Without the version check, the obvious moves were all wrong: close as dup of #12096, or implement an already-implemented feature.

## Corollary: use CI logs as a controlled experiment to settle "would the fix even help?"

The parent's stated suspicion was that `-std=metal4.0` couldn't help a toolchain (`metal 32023.883`) that predates Metal 4 — which would have meant the headline ask was a false lead. Rather than hypothesize, find two CI jobs that differ in exactly one variable:

- slang-rhi CI job — **identical** runner image `macos-26-arm64 / 20260728.0273`, fetched Slang **2026.12.2** ⇒ `0 metal PASSED / 207 SKIPPED`, the metal4.0 error.
- slang CI job, same day — **same image**, in-tree Slang (sends `-std=metal4.0`), in-tree rhi submodule still advertising `metallib_4_0` ⇒ **87 metal tests PASSED**.

One variable differed (Slang version) ⇒ the toolchain *does* accept `-std=metal4.0`. That flipped the recommendation from "capability detection is the only real fix" to "version bump fixes it, and the capability-detection issue is a separate hardening item."

Grep the job log for `Image:` / `Image Release:` to *prove* the images match — otherwise it isn't a controlled comparison. Note `gh api .../actions/jobs/<id>/logs` works even when the run's own log archive is expired.

## Also: a stale triage verdict on the sibling issue can mislead you

#12096's earlier bot triage concluded "**No slang-core change is warranted**" (arguing the macos-26 `metal` predates Metal 4). That was **too strong** — a slang-core change *was* warranted and landed as #12009, and the macos-15 pin (#12075) was reverted in #12129 precisely because it worked. Treat a prior triage comment (even your own bot's) as a dated hypothesis to re-verify at HEAD, not as settled fact — especially when a newer issue's evidence contradicts it.
