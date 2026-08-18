---
title: "Resume-after-pause: re-verify remote state before applying the saved resume plan"
type: learning
topic: verification
source: learnings/1779847439047-resume-after-pause-re-verify-remote-state-before-a.md
---

# Resume-after-pause: re-verify remote state before applying the saved resume plan

# Resume-after-pause: re-verify remote state before applying the saved resume plan

When resuming a fixer chain after a multi-day pause / stand-down, **the saved resume memo on disk may be materially stale** — another session, the maintainer, or upstream automation may have advanced the PR while the chain was paused. Always re-check before acting on the memo.

## Symptoms (what stale memos look like)

- Memo describes "soft-reset to master, mid-flight split-in-progress" — actual branch is 22 commits past master with merge + clang-format integration commits since.
- Memo references `/tmp/spirv-r7-full.cpp` snapshots — `/tmp` is wiped on container restart so they're gone.
- Memo says "Filed: pending follow-up issue" — actual GitHub state shows the issue WAS filed in a prior round (different number than memo guessed) and the PR body already references it.
- Memo says "Draft, awaiting Ready flip" — actual PR is already non-draft with milestone + labels set.

## Quick verification at the start of a resume turn (≤5 commands)

```bash
# A. Disk truth
git log --oneline master..HEAD | head -10           # is HEAD where the memo says?
git status -s                                       # what's actually uncommitted?
ls /tmp/<memo-snapshot>.cpp                         # snapshots survive?

# B. Remote truth
gh pr view <N> -R <repo> --json isDraft,milestone,labels,title,body | jq
gh issue list -R <repo> --search "<follow-up topic>"  # was a related issue already filed?
```

If A and B don't match the memo, **stop and re-plan from observed state, not the memo**. The memo's "Resume sequence" was written for a state that no longer exists.

## Specific gotchas

- **Don't redo work the prior session shipped.** PR body already final → don't replace it. Issue already filed → don't file a duplicate (you'll waste an issue number and have to close yours).
- **Don't trust `/tmp` snapshots across container restarts.** Verify by grep whether the polish the snapshot was meant to restore is already in HEAD — it often is, because the prior session pushed it before the stand-down.
- **Don't force-push to "rebuild round-N split"** if integration commits (master merge, clang-format pass) have landed on the branch since round N. A localized fixup commit on top is safer and squashes identically at merge time.

## Why this matters

Acting on the stale memo after a multi-day pause is the most likely path to wasted effort or destroying merged-down work. A 30-second sanity check (`git log` + `gh pr view`) costs nothing and changes the plan when reality has moved.

Concrete cost in one observed case (slang #10528 / PR #11265 resume on 2026-05-27):
- Wrote a `pr-final-body.md` draft to "refresh" the PR body — the prior session had already done it. Wasted draft work.
- Filed shader-slang/slang#11304 as the "NumSubgroups follow-up issue" — the prior session had already filed shader-slang/slang#11303 with the same scope. Had to close #11304 as a duplicate, refactor all references in the szihs reply / Fix Report / memory note.

Both errors caught only because codex OUTPUT_REVIEW noticed the PR body said `#11303` and the PR was non-draft.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1779847439047-resume-after-pause-re-verify-remote-state-before-a.md`_
