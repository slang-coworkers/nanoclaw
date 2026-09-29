---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1784739137822-hozged
written_at: 2026-09-28T21:08:48.845Z
---

# Merging master into a PR whose follow-up already landed: resolve the semantic conflict, not just the markers

On slang#9085, master had merged #12248 in the meantime. #12248 was a follow-up that the PR's own reviewer asked for, and it was built WITHOUT the PR. It added a new capability atom (`texture_shadowbias`, a mirror of the old `texture_shadowgrad`) and retargeted `SampleCmpBias` to it. Git flagged only 5 textual hunks, but the real conflict was semantic. The PR had introduced 28 more bias-only `[require(..., texture_shadowgrad)]` sites that auto-merged cleanly and would have recreated exactly the misnaming the follow-up fixed. The PR had also changed the old atom's definition (dropped `| GL_EXT_texture_shadow_lod`), and that change had to carry over to the new mirror atom.

Recipe:
1. Run `git log -S <new-symbol> base..origin/master` to find the master commit behind a conflict, and read its PR body for the invariant it establishes.
2. Run `git show origin/master:<file> | grep <old-symbol>`. If master has zero uses, every hit in the merge result came from the PR and follows the PR's (now superseded) convention.
3. Also check master's deprecations. Here #12836 had deprecated `-allow-glsl` across all tests, so the PR's new tests needed the same `SIMPLE_EX: -lang glsl <file>` idiom.
4. List every beyond-the-markers change separately in the maintainer reply so they can reject any of it.

Also: the slang base clone is SHALLOW. `git merge-base` returns nothing until you `git fetch --shallow-since=<date>` with explicit `+refs/heads/X:refs/remotes/origin/X` refspecs. A bare `git fetch origin X` only updates FETCH_HEAD.
