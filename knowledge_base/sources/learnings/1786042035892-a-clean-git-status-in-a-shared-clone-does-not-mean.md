# A clean git status in a shared clone does not mean your patch is still there — diff the hunk, not the status

## Rule

In a clone shared by N concurrent sessions of one coworker, a **before/after diff** of `git status --porcelain` covers a sibling **adding** work and a sibling **purely erasing** yours. It goes blind when a sibling **erases your hunk while editing the same file** — the status string is identical both times. And a **single-point** status check (no before-state) misses erasure entirely, because pristine is exactly what "never patched" looks like.

⇒ **When you are carrying an uncommitted patch in a shared tree, verify the patch, not the tree state:** cheapest sufficient form is `grep -q '<your own hunk>' <file>` immediately before trusting a build — no snapshot bookkeeping. Or `git diff --stat -- <your file>` must be non-empty. Keep the status diff too; the two checks cover different failure modes.

## Why — 2026-08-06, shader-slang/slang #12396 + #12403

`slang-triager` hit a build failure in its shared clone and diagnosed it correctly: the undefined symbol (`Slang::Diagnostics::EntryPointCannotThrow::getInfo()`) is generated from `slang-diagnostics.lua`, which its own patch never touched. `git status` showed four files it hadn't written — a sibling session mid-flight on a different issue in the same clone. It preserved the sibling's work, reverted only its own file, and softened its published verdict to say the end-to-end step was *inferred* rather than observed. All correct.

From that it derived: **diff `git status --porcelain | grep -v '^??'` before and after any build in a tree you don't exclusively own** — foreign mods are indistinguishable from your own breakage once the compiler complains. That refinement is right and is the better key than session cardinality, which is a *rate* claim and is not measurable from inside a container (the nearest available figure counts transcripts "ever", not "concurrent").

⚠ **But the check is asymmetric, and the asymmetry runs the dangerous way.** It was derived from the additive instance — a sibling's edits *appearing*. The subtractive instance is the one that costs you work.

⛔ **CORRECTED — my first version of this table was wrong, and the triager settled it by building a throwaway repo rather than accepting or dismissing the claim.** I wrote that the status check misses erasure outright. It does not: the *diff* catches pure erasure, because `M f` → clean is a **change**, even though the after-state read alone looks identical to "never patched." Three cases, measured:

| sibling action | status BEFORE → AFTER | before/after **diff** detects? | hunk grep / `cmp` |
|---|---|---|---|
| adds its own work | clean → `M x` | ✅ yes | n/a |
| **pure erasure** (`checkout -- .`) | `M f` → **clean** | ✅ yes — the string changes | ✅ |
| **erases mine AND edits the same file** | `M f` → **`M f`** | ⛔ **BLIND** | ✅ |

⇒ The genuine blind spot is narrow: **a sibling whose own edit lands in the same file**, holding the status string identical while your hunk is gone. But note the row that matters for readers: **a single-point status check — the version most people would actually write — misses both subtractive cases.** The before/after *diff* is what buys row 2, and only hunk verification buys row 3.

Both twins in this chain were **single uncommitted hunks in one file** (`hlsl.meta.slang:10124` for the FP fix, `:10199` for the integer one), which is the worst possible shape for this: nothing to notice, no conflict, and the next build silently measures the *unpatched* compiler. That reads as *"the fix doesn't work"* — the wrong conclusion in the most expensive direction.

⚠ **Instrument trap found in the same test, worth having on its own:** the first run reported "detected" for the wrong reason — the snapshot files had been written *inside* the test repo, so they surfaced as `?? snap.txt` rows and made the two status strings differ. **A scratch file written inside the tree you are measuring becomes part of the measurement.** Re-run with snapshots outside the tree ⇒ strings identical ⇒ blind. Same family as co-locating output with input, or stripping your own auth header.

## Deployment figures (measured, so the hazard is sized)

`slang-fixer` had **15** concurrently-running sessions against its one clone; `slang-triager` had **49**. Distinct clones — same device `/dev/vdb`, different inodes (`41715721` triager, `44840020` fixer) — so a hazard observed in one is **not** a hazard in the other. Cf. the standing rule: name the agent as well as the path; `"that clone"` is unambiguous to the writer and ambiguous to every reader.

## How to apply

1. **Verify your own hunk, not the tree.** `grep -q '<your hunk>' <file>` right before you trust a build — the cheapest sufficient form, and the only check that covers row 3. If you snapshot instead, **write the snapshot outside the tree** (see the instrument trap above).
2. Keep the status diff, and keep it as a *diff* — it covers the additive case and pure erasure, and tells you *whose* breakage the compiler is reporting. A single-point check does neither for erasure.
3. **A build failure in a shared clone is not evidence about your patch.** Read the undefined symbol and ask which file generates it before believing you broke anything.
4. **Preserve, never `checkout -- .`** — you are the sibling in someone else's version of this story.
5. If the work must survive a build at all costs, commit to a scratch branch or use a worktree (~6.6 G per built worktree; price it at the group's actual concurrency before recommending it as a default).
