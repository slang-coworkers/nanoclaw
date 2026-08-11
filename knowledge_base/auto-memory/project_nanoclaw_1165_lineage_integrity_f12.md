---
name: project_nanoclaw_1165_lineage_integrity_f12
description: "nanoclaw#1165 (szihs, MERGED 08-10 mid-review) fixes F12 + BOTH 🟠 I raised on #1125. Body's 17-of-31 negative control reproduced exactly. My 🟠: `retire` cannot re-point an L1-borne marker — issuing the CORRECT retire moves a clean tree (rc=0) to permanently rejected (rc=3). Comment 5236704606 via REST."
metadata:
  node_type: memory
  type: project
  originSessionId: 31e9fb32-c736-4563-8453-d51260e0c939
---

# nanoclaw#1165 — learnings-wiki lineage integrity (F12)

PR: https://github.com/slang-coworkers/nanoclaw/pull/1165 (szihs, base `nv-main`, head
`fix/nv-main/wiki-lineage-integrity` `5fa451e5`, 3 files +759/-90). **MERGED 06:26:06Z by szihs,
merge commit `17bd27d7`** — ~7 min after the webhook, mid-review. Merged `SKILL.md` sha256
`92bb9f21…` **identical** to the head I tested ⇒ findings carry to the merged tree. My comment
**`5236704606`**.

## Routing — standing rule, N-th instance (⚠️ do NOT quote an ordinal)

`pr_ready_for_review` carried the generic *"route to the project's `*-pr-approver`"* string.
`slang-coworkers/nanoclaw` has no approver wired; the slang/slangpy approvers are repo-scoped
**compiler** approvers that would `ABSTAIN_POLICY`. Handled INLINE.
See [[project_nanoclaw_pr874_webhook_route_approver]].

⛔**The ordinals in this store DISAGREE and none of them is measured** — #1125 says "~26th", #1161
says "~32nd", #1162 says "7th", and I told the operator "27th" by incrementing #1125's. They cannot
all be right; they are stored conclusions re-shipped as counts (ANCHOR G). ⇒ **state the rule, not
an ordinal**, or derive the count from `grep -c` over the memo set at the moment of writing.

## This PR closes both 🟠 I raised on #1125

[[project_nanoclaw_1125_wiki_fold_lineage]] recorded exactly two findings — retirement is one-way
with the only un-retire path an undocumented dotfile, and a typo'd successor stem is accepted and
invisible. **#1165 is the fix for both** (its P1-c and P1-b). ⭐**A stored finding gave me a
prediction to test the follow-up against** — that is what made this review cheap and what let me
check the correction path *as a whole* rather than just the diff.

## Body verified BY EXECUTION — reproduces exactly

Head `test_learnings_wiki.py` × pre-fix `SKILL.md` from merge-base `fe6b3ce9`, in `/tmp` scratch:

- **17 fail pre-fix (11 failures + 6 errors), 31/31 pass post-fix.** Headline number exact, and the
  failing set is exactly the 17 named in the body's two tables.
- ✅**The four disclaimed "guards, not evidence" are exactly the four ABSENT from the failing set**,
  incl. `test_an_empty_corpus_is_refused…` correctly labelled as erroring pre-fix only because
  `LineageError` does not exist there. The honest-labelling claim is itself accurate — I checked it
  rather than taking it.
- P1-b table strings reproduce on the pre-fix tree: `coverage 1/1 live (1 superseded, excluded)`
  for typo AND self-link; `coverage 0/0 live (2 superseded, excluded)` for A↔B.

⭐⭐**A PR body that states a falsifiable count is cheap to audit and worth auditing** — one control
run settled the whole evidence section. The `sha256sum` of the extracted `SKILL.md` in each scratch
tree is what proves the control ran against the tree I meant.

## My 🟠 — `retire` cannot re-point an L1-borne marker (L1-ONLY; L3 is fine)

P1-c fixes *reverting* a bad retirement, not **correcting** it to the right target when the marker
sits on an immutable L1 atom. `_merge_markers` re-applies the on-disk marker every harvest, so the
operator's `retire` is overwritten each build:

```
build              rc=3  LINEAGE-ERROR missing_target A -> 'TYPO'
retire A C         rc=0  "retired A -> C"      .lineage.json {A: C}
build              rc=3  LINEAGE-OVERRIDE A: recorded C -> on-disk marker TYPO (marker wins)
                         superseded_by {} ; rejected {A: missing_target}
finalize           rc=3  coverage 0/2 live (0 superseded, excluded)
```

All four orderings (`retire`+build · unretire→retire→build · retire→unretire→build) land in the
same `rejected` state; none records `A -> C`.

⭐⭐⭐**SHARPEST FORM — issuing the CORRECT command moves a healthy tree to a broken one.**
`unretire A` alone works (tombstone holds, atom live, rc=0/rc=0). Then naming the real successor:
`retire A C` → build/finalize **rc=3, permanently rejected**. `retire` does
`state["tombstones"].pop(src)` ("naming a target again is a deliberate re-retirement"), removing the
only veto against the L1 typo. **The reward for completing the correction is a persistently red
tree.** ⇒ I would not have found this by reading the diff — it needs the A/B where the *good* path
is run to completion.

**Bounded by a 2-way control:** same typo on the **L3** page → `retire`+build **sticks, rc=0**;
only **L1** fails. Reporting it unbounded would have been the over-general claim ANCHOR C warns
about.

**Only working route is the one the doc forbids:** editing `learnings/<A>.md` → rc=0,
`coverage 0/1 live (1 superseded, excluded)` — but `SKILL.md:22` says L1 is
`(immutable; never edit)` while line 116 tells the agent it MAY write the marker there. The doc
permits creating the state and forbids the only fix.

**Untested:** `test_re_retiring_with_a_different_target_overrides_the_tombstone` re-retires by
**rewriting the L1 atom** (the forbidden hatch), not via the `retire` CLI against a surviving L1
marker. Nothing exercises that combination.

🟠 not blocking: it **fails loud** (LINEAGE-ERROR + LINEAGE-OVERRIDE every run, exit 3) and the atom
stays **LIVE** — the F12 class (silent loss reported as success) is genuinely closed. Suggested fix
(1): `retire` tombstones the *displaced* target alongside the new edge. (2): refuse with the
filename when a conflicting L1 marker exists.

## Confirmed clean

`not isinstance(d, dict)` / `_typed_map` / `edges and not stems` guards are the right shape;
rejecting toward **stays-live** is the correct direction. `.lineage.recovery.json` written **before
the delete sweep** is the load-bearing detail of P1-a and is correct. CI addition is stdlib-only
against the existing `setup-python@v5`; all four checks green (`ci` 2m47s). Agreed on leaving
`fm()`'s document-wide regex alone.

Body's "first prod run will likely exit 3" prediction is worth holding: the **L1-borne subset** of
those stale edges is exactly the state above — the fold agent will be told to fix a marker that
`retire` cannot fix.

## Write path

⛔`gh pr comment` → `GraphQL: Resource not accessible by integration (addComment)`;
`gh api repos/…/issues/1165/comments -X POST` → **id 5236704606** ✓. Second measured instance of
[[feedback_gh_pr_comment_and_rest_comments_are_different_verbs]] on this repo — the recorded fact
paid for itself, one call instead of a wrong capability-negative.

⚠️Merged mid-review ⇒ posted as a **post-merge follow-up** and said so in the first line.
Cf. the #1066 26-second merge race and the #1125 `synchronize` event: **re-check state immediately
before posting**, and when it has moved, re-anchor the comment rather than dropping the finding.
