# A maintainer's "create a PR" is not acceptance of your shape

# A maintainer's "create a PR" ≠ acceptance of your *shape*

**Observed:** slang#12223 (`-Og` broke Debug debugging). We did the feasibility work, posted an offer with two options, and skiminki-nv (the maintainer who authored the regressing PR) replied **"@nv-slang-bot Create a PR for Option 2"**. We implemented Option 2 exactly as scoped, opened draft PR #12234, ran three reviewer passes (all clean). A week later he **closed it unmerged**: *"Closing this one. It doesn't quite seem to be the right fix. PR #12324 is the next attempt"* — and wrote his own fix at a deeper layer.

- **Ours:** conditional-skip of the target-level `-Og` append (per-target, compiler-ID-guarded, whole-`-O`-token detection).
- **His #12324:** seed `CMAKE_C/CXX_FLAGS_DEBUG_INIT` *before* `enable_language()`, so the cache vars initialize without `FORCE` and any user/preset/toolchain value replaces the default. Env `CXXFLAGS`/`CFLAGS` then work **generally**, not just for `-O`.

His is the more root-level fix: ours suppressed a symptom of the ordering, his fixed the initialization layer so nothing needs suppressing. That is what "not quite the right fix" meant — the *direction* (make flags overridable + document it) was adopted; our *shape* was not.

**Why this matters:** a go-ahead answers "should this be fixed and in roughly which direction," not "is your implementation the one that lands." Clean reviews don't change that — all three of our reviewer passes were clean; the PR still wasn't taken. Treat maintainer authorization as scope approval, not design approval.

**How to apply:**
- When a maintainer greenlights a direction, in the PR description **name the layer you chose and the alternatives you rejected, with reasons**. That invites the "wrong layer" objection during review instead of after.
- For build-system/config fixes especially, ask whether the bug is in the *value* or in *how the value gets initialized*. CMake ordering bugs usually have a deeper `_INIT`/cache-level fix than the append site.
- Don't read a merged-clean review slate as landing probability. Keep the branch cheap and expect the maintainer may re-implement.
- When your PR is closed in favor of a maintainer's, **don't re-litigate**. Verify their replacement actually closes the issue, hand over anything you verified that they'd want (edge cases, test matrix), reap your branch/worktree, and close out the chain.

**Related check that paid off here:** #12324's body said `Fixes #12233` — a one-digit typo (#12233 is an unrelated closed PR). Closing keywords only auto-close *issues*, so it linked nothing; verified via the #12223 timeline (no `connected` event, only our own cross-reference). **When a maintainer's replacement PR claims to fix your issue, verify the closing reference resolves** — otherwise the issue silently stays open after their merge.
