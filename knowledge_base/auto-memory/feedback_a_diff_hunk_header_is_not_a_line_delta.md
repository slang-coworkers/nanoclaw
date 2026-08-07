---
name: feedback_a_diff_hunk_header_is_not_a_line_delta
description: "I published a '+1 line shift' after a merge by diffing my OWN two readings taken from different sources; the hunk header @@ -3428,11 +3428,26 @@ said start-line UNCHANGED. Compare against the merge commit's FIRST PARENT, never against your own earlier note."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1dd5892a-bf52-4274-8dd1-46df09e77581
---

# A hunk header states the delta; my two readings do not

**2026-08-06, slang#12371.** I told both `slang-triager` and the operator that #12353's merge
shifted the target block **+1 line** (`if (needsValidation)` `:3428`→`:3429`). Wrong. The lines are
**identical** pre- and post-merge. The triager caught it and had already given the fixer the
corrected version.

## How the false delta was manufactured

I never measured a delta. I **subtracted two readings of my own**, taken hours apart from different
sources: a pre-merge figure carried in the guard prompt's prose (written against the PR *head*
diff), and a post-merge figure I read myself from the merge commit. The difference between them was
an artifact of the two provenances, not of the merge.

⭐⭐⭐ **The authoritative delta was sitting in the hunk header the whole time:**

```
@@ -3428,11 +3428,26 @@ static SlangResult createArtifactFromIR(
     ^^^^         ^^^^
     old start    new start  -- IDENTICAL => the block does not move
```

`-3428,11 +3428,26` says: same start line, 11 lines became 26. **Everything above the hunk is
untouched by construction; only lines BELOW shift**, and by `26-11 = +15` — which is exactly what
the triager measured downstream (`compiler->compile` `:3472`→`:3487`, `disassemble` `:3434`→`:3448`).
My "+1" was not even the right sign of the right quantity.

⇒ **To get a line delta across a merge, read the hunk header, or read the merge commit's FIRST
PARENT (`<merge-sha>^`) and diff that against the merge — one source, two commits.** Never diff your
current reading against an earlier note; you are then measuring the difference between two
*instruments*, and [[feedback_a_negative_control_must_vary_exactly_one_thing]]'s lesson applies — a control validates
the instrument, never the target.

Verified after the fact: `git show`-equivalent read of `9cd92bb3a^` gives `3410/3412/3424/3426/3429/3432`
— byte-identical to the merged figures I had labelled "shifted".

## Why it was nearly harmless, and why that is not the lesson

Both of us told the fixer to **re-read the region rather than patch by line number**, so no
downstream artifact carried the error into code. ⛔ **But the harmlessness was luck of a habit, not a
control** — the same class as [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
Had either dispatch said "apply at `:3429`", a wrong delta plus a correct absolute would have
produced an off-by-one patch in a `#if 0` neighbourhood where it might well have compiled.

⭐⭐ **A derived figure I did not need is a figure I should not have published.** The dispatch's
correctness rested entirely on the *absolute* post-merge lines (which were right) and on
"re-read before patching". The delta was decoration — and decoration is where unverified arithmetic
hides, because nothing downstream fails when it is wrong. Range-check or drop derived figures;
see [[feedback_deference_drifts_to_whoever_corrected_you_last]] on plausible-but-wrong numbers
surviving multiple rounds of mutual verification.

## What I got right and should keep

Reading `:3432` at the merge commit instead of assuming "#12353 rewrote the block, so it probably
fixed the buffer" — it rewrote the block and **kept** `spirv.getBuffer()`. The triager
independently confirmed 7/7 of my table plus a structural check I lacked (inside
`if (needsValidation)`: `linkedArtifact`/`blob` ×0, `spirv.getBuffer()` ×2). ⭐ **The rewrite-implies-fix
inference is the trap that a same-block collision invites; reading the post-merge line is the cheap
refutation.**
