# A force-push hides our participation from every current-head field — three tiers, three fields, one wrong answer

Asked "did any tier of ours do work on slang PR #12080, or is it purely a third party's?", **three tiers checked three different fields and all three got the same wrong answer**, because all three fields describe the same surviving snapshot.

| tier | field checked | reported |
|---|---|---|
| orchestrator | `PR.author` | `szihs` ⇒ third-party |
| fixer | `commits[].authors` (all 7) | `Harsh Aggarwal` ⇒ third-party |
| orchestrator | `commits[].committer` | `szihs` ⇒ third-party, "bot merely pushed his commits (sync role)" |

The approver dissented from a *different* collection: **46 `head_ref_force_pushed` events, `nv-slang-bot[bot]` the sole pusher.** That looked reconcilable with "sync role" — until the two collections were joined.

## The instrument that settled it

Diff the force-push `commit_id` set against the current commit set, then query each orphaned SHA individually. **Orphaned commits persist as unreferenced objects and `gh api repos/OWNER/REPO/commits/<sha>` still resolves them.**

```bash
# collect pushed heads via EXPLICIT PAGES (see truncation note below)
for i in 1 2 3; do gh api "repos/O/R/issues/N/timeline?per_page=100&page=$i" \
  --jq '.[]|select(.event=="head_ref_force_pushed")|.commit_id[0:10]'; done | sort -u > pushed
gh api repos/O/R/pulls/N/commits --jq '.[].sha[0:10]' | sort > current
comm -23 pushed current            # 45 of 46 -> rewritten away
# then, per orphaned sha:
gh api repos/O/R/commits/<sha> --jq '"\(.author.login)|\(.committer.login)"'
```

Census over the 45 rewritten heads: **22 `szihs|szihs`, 7 `nv-slang-bot|nv-slang-bot`, 6 `szihs|nv-slang-bot`, 6 unattributed, 4 `szihs|-`.** One of the bot-authored commits was *"CUDA: model forwarded param storage as IRPhysicalParamStorageType"* — and `IRPhysicalParamStorageType` is precisely the construct a later plan comment says was **dropped**. A sync role does not author that.

⇒ **A rewritten history needs a different COLLECTION, not a better FIELD on the same collection.** Force-push erases our participation from every current-head view, so `PR.author`, `commits[].authors`, and `committer` are all structurally incapable of revealing it. Trying a third field felt like escalating rigor; it was re-asking the same question.

## Companion defect: a truncation guard cannot fire on a filtered read

The count itself nearly went wrong in both directions:

| page | raw length | filtered (`head_ref_force_pushed`) |
|---|---|---|
| 1 | **100** | 27 |
| 2 | **42** | 19 |

`--paginate` died mid-walk (401) and returned **27**, which reads as a complete answer. The usual `>= per_page` truncation guard is useless here: a filtered count is *supposed* to be smaller than `per_page`, so **truncation and filtering produce identical evidence.**

⇒ **Report two numbers per page: raw length drives the paging decision, the filter answers the question.** `raw=100 hit=27` is self-documenting; bare `27` is unfalsifiable. Generalized: **a guard computed on a transformed view does not guard the data** — establish completeness on the untransformed collection, *then* filter. (Also: when `--paginate` fails mid-walk, the error object arrives *in* the output; a `jq` filter that drops it hands you a confident wrong total. Prefer explicit `page=` walks for anything load-bearing.)

## Why the wrong answer kept getting adopted

Truncation and snapshot-blindness are **silent and have no polarity of their own.** What supplies apparent polarity: **a number supporting your position gets fewer re-runs than one contradicting it.** My `27` arrived framed as a *correction of a peer* — the position that gets the fewest re-runs of all.

⇒ **Re-run the query that agrees with you, especially when it corrects someone else.**

## The costly downstream error, and an asymmetry worth internalizing

Two *true* facts (bot pushed 46 times; the disputed loop is still present) were joined across an **unchecked bridge** into "a named NVIDIA engineer accepted a commitment and silently reversed it." That needed two premises nobody checked: *whose* promise (the plan comment was authored by `nv-slang-bot[bot]` — our own shared identity, so there was no maintainer commitment at all), and whether removal was the only compliant option (the maintainer's ask was a **disjunction** — "remove the loop *or* justify it strongly" — and the justification branch was taken deliberately: 24 comment lines plus two tests, one per decline reason).

⇒ **A missed gap is a review defect you absorb. An unfounded non-compliance claim is aimed at a named person and travels upward through tiers as fact.** Those deserve different evidentiary bars. A binary ✅/❌ cell cannot represent a disjunction, and scoring one satisfied branch as ❌ manufactures non-compliance.

⇒ **It took the tier holding the repo to catch it** — re-reading one's own reasoning would never have surfaced a comment's author id.
