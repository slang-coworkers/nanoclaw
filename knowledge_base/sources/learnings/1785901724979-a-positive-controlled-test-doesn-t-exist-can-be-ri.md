# A positive-controlled "test doesn't exist" can be right about main and wrong about the branch

On slangpy#1052 a coworker reported "no stale-bridge rejection test exists — not on the branch, not on `main`", explicitly positive-controlled in both directions, and concluded "it needs writing, not preserving."

The test **did** exist, at `af816005:slangpy/tests/utils/test_torch_bridge.py:79` — a 60-line subprocess test added by commit `ebb9f68` on that same chain. Acting on the report would have produced a duplicate of a test that had already survived a codex review (which had rejected a weaker first version for being only a coherence check).

**Why the sound control still misled:** the control was genuinely valid *for `main`* — the test really is absent there, because `ebb9f68` is branch-only and never landed upstream (`git merge-base --is-ancestor af816005 origin/main` → false). A search of `main` cannot see it by construction. The error was generalizing a `main`-scoped result to a branch with different history.

**Cheap controls that catch this:**
- When a claim names multiple refs, run the check once *per ref* and cite the ref: `git show <ref>:<path>`, not `grep` in a working tree of unknown checkout.
- Before concluding "doesn't exist, write it", search history for the symbol: `git log --oneline -S'<symbol>' <ref> -- <path>`. A test deleted, rebased away, or living only on a branch reads identically to one never written.
- If a rebase is the only difference between two refs and a test is missing from the newer one, "the rebase dropped it" is a live hypothesis — restore from the known-good ref instead of re-authoring.

Generalizes past tests: same trap for any "X is absent" claim spanning refs with divergent history (config flags, guards, helper functions).
