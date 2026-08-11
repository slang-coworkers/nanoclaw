Re-reviewed at `beba52bd` (2nd `synchronize`). Root gate still clean (16 files, rc=0), all five checks green including the new `python` job. The scoping fix from the last push holds. **One finding on the new job, and one correction to its comment.**

## The new `python` job's precondition is not met yet

The `ruff` step's comment says it is *"Wired now that the 15 pre-existing errors are fixed (see the nv-slang PR)"*. They are **not fixed on `nv-slang`** — the fix is **open PR #1177**, unmerged as of this comment. Measured against `slang-mcp`'s own config (`select = ["E","F","I"]`, `line-length 120`, `target-version py310` from its `pyproject.toml`):

```
origin/nv-slang  →  Found 15 errors.   rc=1
   9 E501 · 3 I001 · 1 F811 · 1 F821 · 1 F841
```
Control, same command with #1177's head applied → **`All checks passed!`, rc=0**. So the count is exactly the 15 the comment refers to, and #1177 genuinely clears them — the dependency is real, not a config guess on my part.

**Why it matters here rather than being harmless.** This job no-ops on `nv-main` (I confirmed `container/mcp-servers/slang-mcp/pyproject.toml` is absent on both `nv-main` and this head, so `present=false` and every step is skipped) — that part of the design is sound, and keying the guard on the directory rather than the branch name is the right call. But the comment's own argument is that this copy is the one that *survives deploy-time canonicalization onto the leaf*. On the day that happens with #1177 still unmerged, `nv-slang` gets a `ruff` step that is red on code the leaf's own PRs did not touch — the same "a nv-main change breaks sibling CI" class you just fixed one push ago, reappearing through the deploy path instead of the compose path.

That is a **merge-order constraint between two open PRs**, and nothing in either encodes it. Cheapest fix: land **#1177 first**, then this. Alternatively leave the `ruff` step out of this PR and let #1177 add it to both copies, so neither PR depends on the other's timing.

## Correction: the two copies are not byte-identical

The comment states the job is *"Kept byte-identical to nv-slang's copy on purpose. Canonicalization is then a no-op rather than a behaviour change, which is the only way the ownership caveat #1163 recorded actually closes — two copies that agree cannot drift."*

Extracting both `python:` jobs and diffing them: **19 lines on `nv-slang` vs 38 here**, and they differ structurally, not cosmetically:

- `nv-slang` uses a job-level `defaults.run.working-directory`; this version drops it and repeats `working-directory:` per step.
- This version adds the `Is slang-mcp on this branch?` probe and an `if:` on every step (that is the good part — it is what makes the file correct on both branches).
- This version **adds the `ruff` step**, which `nv-slang`'s copy deliberately omits with a four-line comment explaining why.

So canonicalization is **not** a no-op today: it would replace nv-slang's job with a differently-structured one that runs an additional gate. The reasoning that "two copies that agree cannot drift" is sound, but the premise does not hold at this head — which is the same thing the finding above says, viewed from the other end. Worth fixing the comment even if you keep the code as-is, because a future reader will otherwise trust a non-drift guarantee that isn't there.

## Still open from my previous comment

Neither note from `20af817f` is addressed, and both are still accurate at this head — the fail-open on an unreadable `HEAD_SHA` (`git ls-tree` printing nothing is byte-identical to "no Python", both `rc=0`), and the root gate's position above build/typecheck/tests. Both remain non-blocking; the first is latent, not live.

Everything I verified in the previous comment re-checked clean at `beba52bd`.
