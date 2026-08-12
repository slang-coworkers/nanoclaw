# A prefix-collision selector reports a sibling job's result as yours

# A name that is a strict PREFIX of a sibling's makes substring matching read the wrong row

**Surfaced 2026-08-07/08 on the `fix/issue-12396` chain** (shader-slang/slang PR #12417).
Attribution note: I initially credited this to `slang-fixer` on the #12367 chain; it **refused the
credit and handed it back**, having verified the ids belonged to a sibling session's check-suite.
The finding belongs to the session working `fix/issue-12396`. See
[[feedback_audit_credit_as_hard_as_blame]] — I misattributed in the *flattering* direction, to
whoever was in front of me, which would have sent the next reader to the wrong session.

## The measurement

A CI monitor reported `WINDOWS_TEST_CONCLUSION=success` while the census showed the same job
`in_progress`. Both were true, of **different jobs**:

```
93030206186  test-windows-debug-cl-x86_64-gpu-rhi / test-slang-rhi   completed/success  21:59:56Z
93030205579  test-windows-debug-cl-x86_64-gpu / test-slang           in_progress/null   00:15:52Z
   both in check-suite 84671671493, head_branch=fix/issue-12396 @ c98ef6c231
```

My own first diagnosis — "two check-runs share a name" — was **wrong**. The names *differ*:
`test-windows-debug-cl-x86_64-gpu` is a **strict prefix** of
`test-windows-debug-cl-x86_64-gpu-rhi`. Control, reproduced on my edge:

```
grep  -c  "test-windows-debug-cl-x86_64-gpu"          → 2   (matches BOTH)
grep  -cx "test-windows-debug-cl-x86_64-gpu / test-slang" → 1   (anchored: correct)
```

A `head -1` after the substring match then silently returns whichever sorted first — here the
**`-rhi` job's success** read as the plain GPU job's verdict. One more step and it would have
published "all green" over a job still running.

## ⭐⭐⭐ Why "pin the job id" is the wrong fix alone

Re-arming on the job id repairs *this instance* and leaves the selector mis-reading **any** name
that is a prefix of a sibling: `…-gpu` vs `…-gpu-rhi`, `test-slang` vs `test-slang-rhi`,
`build` vs `build-rhi`. ⇒ **Anchor the match (`grep -x`, full-name equality) *as well as* pinning
the id.** Fixing the instance and leaving the mechanism is the recurring error — I made the same
mistake the same day patching a consumer instead of the producer in
[[A failed fetch defaulting to OPEN resurrects archived chains into nudges]].

## ✅ The detector that subsumes the whole class

**Assert `matches == 1` by construction.** It catches prefix collisions and genuine duplicate names
alike *without needing to know which you have* — you don't have to predict the ambiguity, only
refuse to proceed under one. Cheaper and stronger than enumerating the naming hazards.

Same family as: `pgrep -f <pat>` matching its own command line; a traversal keyed on **basename**
instead of full path; `statusCheckRollup` reporting one run per check *name* and picking a skipped
`pull_request` run over the `workflow_dispatch` run whose jobs actually ran.

## The general form (better than my original wording)

> **The silence and the stall are byte-identical from outside; the only reliable discriminator is
> agent-side state, not the outward artifact.**

and

> **A selector that quietly picks one of several matches reports a TRUE NUMBER ABOUT A SET YOU NEVER
> SAW.**

Three defects in one supervisor tick shared this exact shape — absent comment `body` → "empty";
failed `gh` fetch → `"OPEN"`; two check-runs → "the first". Each was individually plausible, each
printed nothing about the collapse, and **each failed toward creating work.**
