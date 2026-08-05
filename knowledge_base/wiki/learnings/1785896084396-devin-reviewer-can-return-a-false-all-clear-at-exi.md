---
title: "Devin reviewer can return a false all-clear at exit 0 (done-check matched GitHub's rail Checks N/M)"
type: learning
topic: review-process
source: learnings/1785896084396-devin-reviewer-can-return-a-false-all-clear-at-exi.md
---

# Devin reviewer can return a false all-clear at exit 0 (done-check matched GitHub's rail Checks N/M)

On shader-slang/slang#12353 Reviewer B (Devin, via `slang-pr-review-runner`'s `devin-fetch.sh`) returned `(none reported)` for Bugs, Flags AND Informational at **exit 0**, on a PR where three agents had already found real defects. This is a **fourth failure mode**, distinct from the three usually guessed (fetch-failed / timed-out / genuinely-missed): **the analysis completed correctly and the harvest never happened.** It produces a confident wrong answer instead of a visible error.

## Mechanism

The done-check required the AI-analysis heading AND any of six summary patterns. Replaying the saved page, exactly one matched:

```
\b\d+\s+Bugs?\b        -> False
\b\d+\s+Flags?\b       -> False
\bNo (bugs|flags)\b    -> False
All checks passed      -> False
checks? failed         -> False
Checks\s*\d+\s*/\s*\d+ -> True   match='Checks\n45/45'   <<<
=> done = True
```

`Checks 45/45` is **GitHub's right-rail CI-check counter**, not a Devin findings summary. Its neighbours prove it: `Analysis complete / View results / Checks 45/45 / Reviewers 2 / Assignees 1 / Labels 1`. And `gh pr checks 12353 | wc -l` = **45** exactly. That string is in the right rail of *every* PR page regardless of findings, so the predicate reduced to `heading && true`.

Devin's real findings sat behind an unexpanded **`View results`** control. The expander only clicked buttons matching `^(\d+ Bugs?|\d+ Flags?|No (bugs|flags))$`, so no panel opened, and the extractor then truthfully reported empty sections.

Critically: the `Generating…` still-streaming guard (the documented failure mode everyone checks first) **correctly returned False** here. It cannot catch this. That's why the output read clean to two reviewers.

## Fix (applied 2026-08-05)

In `~/.claude/skills/slang-pr-review-runner/scripts/devin-fetch.sh`:
1. Removed `Checks\s*\d+\s*\/\s*\d+` from the `:109` done-check alternation.
2. Added a `^View results$` click pass to the expander.

Regression-tested against the artifact that fooled it: `OLD done=True` → `NEW done=False` (keeps polling, then exits 3 **visibly**). A loud failure that's occasionally wrong beats a quiet one that's confidently wrong.

Gotcha while fixing: my first explanatory comment used **backticks** around `Checks 45/45` inside the single-quoted shell string holding the JS — `bash -n` failed with `syntax error near unexpected token '('` at line 110. The comment describing the bug would have broken the script that had the bug. Always `bash -n` after editing, even "just a comment".

## How to apply

- Every done-check pattern must be specific to Devin's **findings** panel. Never add one that also matches GitHub rail metadata (`Checks N/M`, `Reviewers`, `Assignees`, `Labels`).
- Existing guards are necessary but insufficient: grep `devin-flags.md` for `Generating` (half-rendered) and for the expected PR number (cross-PR contamination). **Neither catches this mode.** Also require a genuine findings summary (`N Bugs` / `N Flags` / `No bugs`) to be present — not just exit 0.
- Report a broken instrument as `_skipped: <reason>_`, **never** as a clean reviewer, and never count it toward `reviewers_complete`. Nothing-reported by a broken tool is not nothing-to-report.
- The alarm that actually worked: `(none reported)` on a PR with known defects was **implausible on its face**, so read the page instead of the tally. Implausibility has the best detection record here.

## Unrelated but adjacent: A and C share a checkout

Reviewer A (`compose-and-run.sh`) runs in the **shared** `/workspace/agent/slang`, and its `pr` mode deliberately leaves `origin/master` checked out (it reads the PR via `gh pr diff`). Reviewer C isolates itself into its own `wt-clarity-*` worktree. So never `git checkout` in the shared clone while A is live — I did, and A read `slang-diagnostics.lua` from the working tree during that window, which silently showed it the PR-applied file instead of master. Use `git worktree add /workspace/agent/wt-<num>-verify <ref>` for your own verification instead.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785896084396-devin-reviewer-can-return-a-false-all-clear-at-exi.md`_
