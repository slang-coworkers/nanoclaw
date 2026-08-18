---
title: "[approver/infra-abstain] devin-flags.md renders an EMPTY Flags section while devin-page.txt from the same fetch has the findings — recurrence, and devin-fetch stalls silently after URL rewrite"
type: learning
topic: review-approval
source: learnings/1785844085143-approver-infra-abstain-devin-flags-md-renders-an-e.md
---

# [approver/infra-abstain] devin-flags.md renders an EMPTY Flags section while devin-page.txt from the same fetch has the findings — recurrence, and devin-fetch stalls silently after URL rewrite

# Two Devin harness defects, both observed on one PR (slang#12324, 2026-08-04)

Neither produced an `ABSTAIN_INFRA` here (the primary `github-actions[bot]` tier
was intact, so Devin was corroboration only), but both would silently zero the
Devin signal on a **Devin-only tier** — the case where Devin *is* the whole
review input.

## Defect 1 — `devin-flags.md` Flags section empty while the same fetch's page dump has all findings (RECURRENCE)

`devin-fetch.sh` exited **0** and wrote `devin-flags.md` (5053 bytes, "9 lines").
Its `## Flags` section was **empty**. `devin-page.txt` from the *same* fetch
(10353 bytes) contained, verbatim near the tail:

```
0 Bugs
1 Flag
`WIN32` is available before `enable_language()`, so the guard works as intended
Investigate                       CMakeLists.txt:59-62
Documented `CMakeUserPresets.json` example requires a newer CMake than the stated minimum
Informational                     building.md:107-121
`_INIT` prepend interacts fine with presets that already set flag `_INIT` variables
Informational                     CMakeLists.txt:59-62
Scope change: Debug `-Og` now also applies to in-tree dependencies and C sources
Informational                     CompilerFlags.cmake:175-197
Checks 50/50
```

**Four items — 1 Flag + 3 Informational — none of which reached
`devin-flags.md`.** Previously observed on slang#12246; this is at least the
second occurrence, so it is a standing property of the extractor, not a one-off.

**Root cause (inferred, labeled):** the flags live at the very end of the SPA's
rendered text, after the full diff body; the extractor's section parse appears to
terminate before reaching them. `devin-flags.md` embeds the whole page text under
`## AI Analysis` and then emits an empty `## Flags` — consistent with a
section-boundary miss rather than a fetch failure.

**How to catch it — a downstream reader cannot, from `devin-flags.md` alone.**
An empty Flags section is indistinguishable from a genuinely clean Devin review,
and *clean* is the direction that reduces scrutiny. So:

> **Never read `devin-flags.md` alone. Always cross-check `devin-page.txt` from
> the same fetch** for `-i 'flag|bug|severity|informational|Investigate'` and
> reconcile explicitly. Report which file each finding came from.

Positive control that makes the check trustworthy: the page dump also carries a
`N Bugs / M Flag` counter line — if that counter is non-zero and
`devin-flags.md`'s Flags section is empty, the artifact is defective, full stop.

## Defect 2 — `devin-fetch.sh` can stall indefinitely after the URL rewrite, then succeed on a plain retry

First invocation (inside a subagent) wrote only:

```
>>> devin-fetch: rewrote GitHub URL → https://app.devin.ai/review/shader-slang/slang/pull/12324
```

…and then produced **no further output and no artifacts** — no
`devin-flags.md`, no `devin-page.txt`, no `devin-exit.txt`, no screenshot — with
no error and no non-zero exit surfaced. Not a timeout code (2/3/4); just a stall.

**One adversarial retry of the identical command, `timeout 420`, exited 0** and
produced the full artifact set (`devin-flags.md`, `devin-page.txt`,
`devin-commit-status.txt`, `devin-exit.txt`, `devin-informational.txt`,
`devin-screenshot.png`, 128 KB). So the stall is **transient**, and a first-attempt
stall is **not** evidence Devin is unavailable.

**How to catch it:** treat "no artifacts on disk and no exit code written" as
distinct from a reported skip. Check `ls <out>/ | grep devin` rather than trusting
the runner's stdout, and always give it one bounded retry (`timeout`) before
writing `DEVIN_SKIPPED` or `reviewers_complete: false`.

## Fix / transferable rules

- **A tool that exits 0 having written a structurally-empty artifact is worse
  than one that fails** — the quiet failure is self-consistent and nothing prompts
  a re-check. Same family as preferring a loud failure to a quiet one.
- **Cross-check every derived artifact against the raw capture from the same
  fetch.** The extractor and the page dump are two consumers of one fetch; when
  they disagree, the raw one wins.
- **Bound-and-retry before declaring a capability unavailable**, and name the
  method: "could not verify by `devin-fetch.sh` (2 attempts)" — never "Devin
  unavailable". A false capability-negative has no observable failure signature.
- **On a Devin-only tier both defects are decision-affecting:** defect 1 turns a
  1-Flag review into an apparently clean one; defect 2 turns a working Devin into
  a spurious `NO_REVIEW_SIGNAL` abstain.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785844085143-approver-infra-abstain-devin-flags-md-renders-an-e.md`_
