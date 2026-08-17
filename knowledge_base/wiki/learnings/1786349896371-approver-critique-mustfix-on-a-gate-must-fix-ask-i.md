---
title: "[approver/critique-mustfix] On a gate must-fix, ask 'is the target inside my edit surface?' FIRST — contest scope with a citation, don't argue merits (RETRACTS my slang-rhi#819 policy-gap escalation)"
type: learning
topic: review-approval
source: learnings/1786349896371-approver-critique-mustfix-on-a-gate-must-fix-ask-i.md
---

# [approver/critique-mustfix] On a gate must-fix, ask "is the target inside my edit surface?" FIRST — contest scope with a citation, don't argue merits (RETRACTS my slang-rhi#819 policy-gap escalation)

# On a critique-gate `must-fix`, the FIRST question is scope — and I reached for the unfalsifiable objection instead

⛔ **This RETRACTS the escalation in my prior atom** (`[approver/critique-mustfix] I argued four
paragraphs against a critique must-fix…`). That atom ended by telling readers to flag a **policy
gap**: "as written, any author-side comment-hygiene must-fix forces an abstain on an otherwise
approvable PR." **The operator ruled there is NO gap — my escalation was over-wide.** The rule was
already scoped; I just never invoked the scope. Everything that atom says about *not* arguing a
control's merits stands. The prescription ("escalate the contract") was wrong and is replaced below.

## The ruling (verified on my own edge before accepting)

`container/skills/codex-critique/SKILL.md:51` — *"Comment hygiene **(when a code diff is under
review)** …"*. And the stage table in that same file (`:40-42`):

| stage | artifact |
|---|---|
| `CODE_REVIEW` | `git diff <base>..HEAD` + test path/result |
| `DECISION_REVIEW` | **the derivation** — clauses from data, verdict parse vs. review doc, source tier |
| `OUTPUT_REVIEW` | **the deliverable** — ledger line + message |

Only `CODE_REVIEW` takes a diff. My two gated stages are `DECISION_REVIEW` and `OUTPUT_REVIEW`, so
**author test comments were never in scope for either stage** — the finding was out of contract for
the stage that produced it.

⭐⭐ **The operator flagged their own caveat: they read a dev clone, not the composed file I execute,
and asked me to speak up if mine differed. So I hashed mine before agreeing:** `codex-critique/SKILL.md`
md5 `ac996c3b`, 85 lines, single copy; `slang-pr-approver/SKILL.md` md5 `65b483bb`, 218 lines — both
identical to theirs. ⇒ **When a peer rules on your behaviour by citing a file path, hash YOUR copy
before conceding. Instruction files are composed per coworker; agreeing about a path is not agreeing
about a file.** (Here it matched, which is what makes the ruling binding rather than approximate.)

## Root cause — the method error, which is the whole lesson

I had **two** ways to disagree with the gate:

1. ❌ **Merits** — "comment hygiene shouldn't gate an approval decision" (4 grounds, ~200 words).
   Unfalsifiable, needs my judgement to be trusted, and **one of the four grounds was outright
   false**. It did not survive, and it should not have.
2. ✅ **Scope** — *"this finding is out of scope for `DECISION_REVIEW`, per
   `codex-critique/SKILL.md:51`."* One line. A third party verifies it with one command.

I reached for (1). The tell: (1) *felt* more thorough — four numbered grounds, principled
scope-defence — while (2) is a single citation. **The elaborate objection felt like rigour; the
checkable one was the rigorous one.**

⭐⭐⭐ **And the scope condition was in text I supply myself.** That parenthetical lives inside the
`developer-instructions` block I paste verbatim into every codex call. I authored the limit into the
reviewer's own instructions and then read past it. **A constraint you hand to a reviewer is a
constraint you can hold it to.**

## The rule to apply

```
Gate returns must-fix
  └─ Is the target inside MY edit surface?
       ├─ NO  → CONTEST SCOPE, cite the line. Do NOT argue merits. Do NOT abstain.
       └─ YES → revise-or-abstain applies (slang-pr-approver/SKILL.md:156;
                CRITIQUE_MUSTFIX is an enumerated ABSTAIN_POLICY reason at :137)
```

⭐⭐⭐ **Generalized: prefer the objection a third party can check in one command over the one that
requires trusting your judgement.** Both are "disagreeing with a gate"; only one is auditable. This
applies well beyond critique gates — to CI failures, review comments, and policy pushback.

⭐⭐ **Corollary on escalation:** before escalating "the contract is broken", grep the contract for a
scope condition that already covers your case. An over-wide escalation costs an operator a full
verification pass to refute — and mine was refuted by a line I had in front of me the whole time.

## What was right, kept for calibration

- **Superseding my own recorded `WOULD_APPROVE`** once I found the revise-or-abstain rule. The
  abstain was correct *given* I accepted the finding; the acceptance was the wrong step, which sits
  **upstream** of the disposition. Retracting costs more than being right first, and the record of
  the error outlives a clean row.
- **Re-querying when a best-effort tool's metadata contradicted my staged PR snapshot** (Devin's page
  said "Merged", my snapshot said OPEN). Trusting neither side of a contradiction is how the mid-run
  merge at my exact pinned head surfaced.
- ⭐⭐ **Tag a procedural mis-derivation as a DIFFERENT failure class from an over-strict evidence
  bar.** Do not let a row like this inflate an over-conservative/standing-bar count — the causes are
  unrelated and the fixes are opposite.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786349896371-approver-critique-mustfix-on-a-gate-must-fix-ask-i.md`_
