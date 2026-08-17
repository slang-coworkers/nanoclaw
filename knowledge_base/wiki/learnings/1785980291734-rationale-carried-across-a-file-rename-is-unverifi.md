---
title: "Rationale carried across a file rename is unverified rationale — re-derive it"
type: learning
topic: verification
source: learnings/1785980291734-rationale-carried-across-a-file-rename-is-unverifi.md
---

# Rationale carried across a file rename is unverified rationale — re-derive it

## What happened

2026-08-06, #12145. I argued for an in-job CI retry partly on the grounds that `actions/download-artifact` resolves **scoped to the current run attempt**, so a test-only `gh run rerun --failed` couldn't see the build job's artifact. I flagged it as unreproduced — correctly, because it turned out **false for the current workflow**, and I had to retract it publicly after already publishing it to a maintainer.

The measurement that settles it, on 4 of 4 runs: the `build` job's `started_at` is **byte-identical across attempts** (so it was never re-executed), yet `Test (Falcor)` re-ran alone, downloaded the artifact, and **passed**. Partial rerun resolves the artifact fine.

Where the false claim came from: it is **accurate for the workflow this one replaced.** `.github/workflows/falcor-test.yml` was pwsh with `$ErrorActionPreference = "Stop"` and its own build+test split; slang#11605 (`6fac3e6d0`) deleted it and folded Falcor testing into the bash `ci-falcor-test.yml`. The reasoning survived the rename; the verification did not.

## Rules

1. **When an external index (DeepWiki, a wiki page, an old learning) contradicts HEAD, the first hypothesis is "correct about a different commit," not "wrong."** The two diverge in what you do next: a *wrong* source gets discarded; a *stale* source may still carry valid rationale for a superseded design. You cannot tell which without reading the deleted version.
2. **Find the deleted file by its old name, not the current one.** A path-scoped `git log` on the *current* filename shows nothing and makes the old content look invented:
   ```
   git log --all --diff-filter=D -- <old/path.yml>     # the deletion commit
   git show <sha>^:<old/path.yml>                      # its final content
   git log -S'<distinctive string>' --all              # when you don't know the old name
   ```
3. **Rationale inherited across a rename/refactor is unverified rationale.** Re-derive it against the successor before stating it — and *especially* before publishing it. A hedge ("unreproduced") is the right label, but a hedge on a load-bearing reason in a maintainer-facing artifact is still a liability: hedged-but-wrong took a public retraction to undo.
4. **Prefer an experiment you already own.** The refutation needed no new infrastructure — the runs I'd cited for the retry-success rate *were* the artifact experiment, one field (`started_at` per attempt) away. Ask what your existing evidence already answers before labeling something unmeasurable.

## Corollary — retract the reason, keep the conclusion separate

My recommendation didn't change; only one of its supports did. Say that explicitly. A correction that reads as "the whole thing was wrong" invites re-litigating a sound conclusion, and burying the retraction invites the next reader to re-inherit the bad reason. Name which claim died, which survive independently, and what the practical upshot is (here: the run-level alternative is *more* viable than I said, not less).

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785980291734-rationale-carried-across-a-file-rename-is-unverifi.md`_
