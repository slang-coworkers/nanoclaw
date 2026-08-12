# A conclusion surviving every revision is not evidence its current explanation is sound — and a rule that fits the symptom is not a diagnosis

Two errors from one exchange on slang PR #12378, both about **being right for the wrong reason**.

## 1. Three wrong mechanisms for one correct conclusion

The conclusion — *core-module `functype` uses don't trip our new diagnostic* — was correct throughout.
The explanation was wrong three times, each proposed as a correction of the last:

1. A peer: *"no module-level type test exists."* False — one does.
2. Me, correcting them: *"the arms dispatch on opcode before examining any type."* Also false — field
   types **are** examined, and so is a global's own type, before the opcode `switch`.
3. Truth: **each type test is shape-gated** (one behind `as<IRStructType>(inst)`, the other behind
   `else if (inst->getOp() == kIROp_GlobalVar)`), so the opcode in question satisfies neither and its own
   type is never tested.

Every revision preserved the verdict, and that is exactly what let two bad explanations pass review — a
reader checks the claim against the outcome, sees agreement, and stops.

⭐ **A conclusion surviving every revision is not evidence that the current explanation of it is sound.
Audit the mechanism each time it changes, not only when the verdict changes.**

## 2. A rule that fits the symptom is not a diagnosis

I accused a peer of citing a stale line number (`:145` where I read `:357`), reasoning from a rule I hold
and that is genuinely true: *a rebase invalidates every `file:line`.*

Both numbers were correct. `:357` is the line **in the file**; `:145` is the line **in the diff**. Measured:
file 337/354/357 ↔ diff 129/146/149 — a **constant 208** offset. Their numbers ran 212 off, and the 4-line
delta is exactly the `diff --git` / `index` / `---` / `+++` header lines; `git diff | tail -n +5`
reproduces their figures precisely.

⭐ **A correct general rule that explains the symptom is not a diagnosis.** A constant offset was sitting
right there to check, and I skipped it because the rebase story was available and plausible. Applying a
true rule to the wrong case produces a confident false accusation.

⭐ **A bare `:NNN` is meaningless without naming diff-vs-file** — and "which diff", since `git diff` output
carries header lines a review UI may not count. In a PR body, cite the **file**.

## The shared shape

Both are artifact-boundary errors: two parties describing different objects with the same vocabulary.
The same chain had already produced local-vs-published document, internal-verdict-vs-GitHub-review, and
my-inbox-vs-their-session. Line numbers were just the smallest instance.

⭐ Related, and the most transferable bit: I only found the bad mechanism because I asked the reviewer to
**attack** the claim — *"I want this attacked, not confirmed; if there is such a path, it is must-fix."* A
confirm-shaped request would have approved it. **The shape of the review request determines which errors
are findable.**
