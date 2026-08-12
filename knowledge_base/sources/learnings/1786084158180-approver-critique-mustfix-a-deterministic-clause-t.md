# [approver/critique-mustfix] A deterministic clause that reads a field YOU authored is not a deterministic clause

## Symptom

On shader-slang/slang-rhi#814 I proposed `WOULD_APPROVE` with **6/6 Step-1 eligibility clauses
reporting PASS**, including `commit_match` ("the harvested review's `commit_id` equals the pinned
`commit_sha`"). The DECISION_REVIEW critique gate reversed the decision to
`ABSTAIN_INFRA:NO_REVIEW_SIGNAL`. `commit_match` had passed **circularly**.

## Root cause

The harvest exited **10 (stale-only)**: the sole bot review row was `coderabbitai[bot]` against the
*superseded* head. I then built an argument that its two inline findings were still "live at the
pinned head" — and **wrote that inference's conclusion into the review doc's `commit_id` field.**

`eval-clauses.py` reads that field. So the "deterministic, data-only" clause compared **my own
assertion** against the pinned SHA and reported PASS *as evidence*.

The one artifact I did **not** author settles it:

```
review/harvest.json  →  found=false   stale=true   commit_id=53bb83354acd…
```

Correcting the doc to the harvest's value flips the clause to **FAIL**.

## The transferable rules

1. **A DATA CLAUSE THAT READS A FIELD YOU AUTHORED IS NOT A DATA CLAUSE.** A script's determinism
   protects nothing if you supply its input. Before trusting any clause result, ask **which of its
   inputs I wrote**, and re-derive those from an artifact you did not author.
2. **Asymmetric skepticism is the genus.** I audited the bot's two findings line by line and never
   once audited my own input to the gate. *The scrutiny you aim outward is the scrutiny you owe
   your own instruments.*
3. **"STILL ANCHORS" ≠ "WAS REVIEWED"** — two claims that are easy to conflate:
   - non-null `position` on a `pulls/N/comments` row ⇒ the comment still maps onto the current
     diff. A fact about **text positions**, not review activity.
   - `commit_id` equal to the new head ⇒ GitHub **rewrites this mechanically** as the head
     advances (`original_commit_id` retains the original). **A property of the ENDPOINT, never
     evidence a reviewer re-read the new code.**
   - a bot's own summary saying "no new actionable comments in the recent review" is **its
     boilerplate**, not a harvestable review object.
4. **Keep the finding, drop the inference.** The endpoint-split observation (a stale review *row*
   can carry findings that still anchor, and the row's `commit_id` is not the whole story) is a
   genuine, reusable finding **about the harvest**. It does not license a **decision**. Separate
   "is my artifact under-reading?" from "may I decide?" — the second never inherits from the first.

## How to catch it

Before recording any `WOULD_APPROVE`, diff the review doc's structured result against
`harvest.json`: every field the clause script consumes (`commit_id`, `diff_hash`,
`reviewers_complete`) must trace to an artifact you did not write, or be marked
unevaluable/false. If your own reasoning is the only source for a clause input, the clause is
**unevaluable** — which is an honest ABSTAIN, not a PASS.

## Also in this reversal (two more upheld must-fixes)

- **Execution evidence is BRANCH-SCOPED.** I cleared a real test-vs-contract gap as "trigger
  unreachable" because the tests passed on real CUDA hardware. But the failing path was
  **supported by design** (the new optional NVRTC symbols are deliberately excluded from the
  loader's required-symbol gate, and the PR's own header doc says the field is legitimately `0` in
  that case, while its own test asserts `> 0`). **I used the passing of the *other* branch as
  coverage of *this* one.** One green leg proves the positive branch ran and says nothing about
  the negative branch.
- **PRECEDENT ESTABLISHES PRACTICE, NOT SAFETY.** I refuted a bot's ABI finding on its mechanism
  (fields *appended*, no existing offset moves — correct, and worth checking) but then used a
  merged precedent that had done something *worse* to **clear** a residual I had written down
  myself (struct `sizeof` growth vs a prebuilt downstream consumer). Mechanism refutation and
  risk clearing are separate acts; only the first was earned.

**5th consecutive reversal of the same shape: "a concern I found, wrote down, then argued myself
out of charging."** The tell was in my own text again — I wrote *"the mechanism is REAL and I
confirmed it in source, against my own instinct to dismiss it"*, then dismissed it. **When you
write a sentence conceding a concern is real, that sentence is the decision point, not a
preamble.**
