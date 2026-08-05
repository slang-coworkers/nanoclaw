---
name: project_nanoclaw_1066_kb_fold_bounded
description: "nanoclaw#1066 (szihs) bounded the learnings-wiki fold — MERGED c2a7639 26s BEFORE my review posted. The superseded_by defect is LIVE on nv-main and needs a follow-up PR. I reviewed it myself (no nanoclaw pr-approver exists); review-state writes are blocked for this app on slang-coworkers/nanoclaw."
metadata: 
  node_type: memory
  type: project
  originSessionId: ff4ea47c-1db4-4c17-ab8e-6d7415dadae9
---

# nanoclaw#1066 — bound the learnings-wiki fold

PR: https://github.com/slang-coworkers/nanoclaw/pull/1066 (author **szihs**, base `nv-main`,
head `fix/nv-main/kb-fold-bounded`, 3 files, +54/-16). My review comment `5179404594`;
post-merge follow-up `5179614225`.

## 🔴 STATE — **MERGED, defect LIVE, follow-up PR OWED**

⛔**`merged_at` = `2026-08-04T12:58:15Z` by szihs (merge commit `c2a7639`); my review posted
`12:58:41Z` — 26 SECONDS LATE.** The blocking finding landed on an already-merged PR.
⭐⭐**A PR being "ready for review" is a claim about a MOMENT — by the time a review is drafted
it can be merged; the webhook is not a lock.** ⇒ **re-check `merged`/`state` before writing a
verdict, and if it merged, re-verify against the MERGED TREE and say so** (a finding filed under
a merged banner is easy to miss — this is the POSITION rule crossing a lifecycle boundary,
cf. [[feedback_correction_unapplied_until_every_restatement_fixed]]).

✅**Re-verified on the merged code** (builder extracted from
`origin/nv-main:container/skills/learnings-wiki/SKILL.md`, fresh sandbox, live files untouched):
`2/2 live (1 superseded)` → daily `build` → **marks surviving: 0** → `2/3 live (0 superseded)`,
atom back as UNCOVERED. **The defect is LIVE on `nv-main`.**

⚠️`/tmp` is WIPED BY A CONTAINER RESTART — my first re-run silently lost its fixture and printed
`0/2` (no citations). ⭐**a rebuilt harness that returns a DIFFERENT number is telling you the
harness broke, not the finding changed** — rebuild from source, don't reinterpret.

RESUME = **offer accepted ⇒ open the follow-up PR** (preferred fix: persist retirement OUTSIDE
the regenerated tree — a KB-root manifest `build` doesn't touch, so the L1-immutable contract
stays intact). Offered in `5179614225`; awaiting szihs's word.

Touches `container/skills/learnings-wiki/SKILL.md` + `container/spines/base/context/workspace.md`
+ `container/spines/base/identity/main-body.md` — i.e. **my own spine** and the skill whose output
tree (`/workspace/shared/`) is Main-write-only ⇒ I am closest-to-the-state.

## Routing fact — nanoclaw has NO `*-pr-approver`

The `pr_ready_for_review` webhook says "route to the project's *-pr-approver". For
`slang-coworkers/nanoclaw` **there is none** — only `slang-pr-approver` / `slangpy-pr-approver`
exist, and both are **repo-scoped** (their ledger keys on repo; they'd return `ABSTAIN_POLICY`).
⇒ **Handle nanoclaw PRs myself.** Do not misroute to a slang/slangpy approver.

## ⛔ Write-authority fact, MINE-MEASURED 2026-08-04

`gh pr review --request-changes` on this repo → **`GraphQL: Resource not accessible by
integration (addPullRequestReview)`**. Plain issue-comment POST **works** (`5179404594`).
Repo perms report `{admin,maintain,push,triage}: true` and `x-ratelimit-limit: 5000` on the repo
path — **so perms+ratelimit look fully green while the review-state write is still denied.**
⭐ Same family as the endpoint-split lesson: **`permissions` is not evidence about which *verbs*
an integration may use.** ⇒ For a verdict on this repo, post an **issue comment**; don't burn a
round-trip on `--request-changes`. (`gh pr ready`/`merge` remain operator-gated regardless.)

## The blocking finding (reproduced, not argued)

`finalize()` reads `superseded_by:` from `wiki/learnings/*.md`, but `build()` **deletes and
regenerates that whole tree** (everything under `WIKI` except `concepts/`). The daily order is
`build` → synthesize → `finalize`, so the mark is gone before `finalize` runs.

Harness: extracted the fenced python block from the PR-head `SKILL.md` into a sandbox KB at
`/tmp/kbtest` seeded from 3 live atoms (live `/workspace/shared` untouched):

```
finalize, no supersession:           coverage 2/3 live (0 superseded, excluded)  UNCOVERED 1
mark in wiki/learnings/<x>.md:       coverage 2/2 live (1 superseded, excluded)  ← works
then daily `build`:                  marks surviving build: 0
finalize again:                      coverage 2/3 live (0 superseded, excluded)  UNCOVERED 1
```

⭐⭐ **It fails GREEN-LOOKING**: the operator sees `0 superseded, excluded` and cannot distinguish
"nothing retired yet" from "retirement isn't persisting."

Marking the **L1 atom** does persist (`2/2` after a full cycle) — but contradicts the same diff's
own `L1 ... (immutable; never edit)` (SKILL.md:22 **and** :137), and lands the key in the page
**body** below the `# Title`, where `fm()`'s `re.M` matches it **by accident**, not by design.
Offered 3 fixes: manifest outside the regenerated tree / `build` carries it into frontmatter /
relax L1-immutability explicitly.

## Scope note posted

Target is `0 oversize, 0 missing-TL;DR` and the spine now tells every coworker `limit=60` on the
promise that every page opens with a `## TL;DR`. **Live: 47 concept pages, 0 with a TL;DR**;
`review-approver-decision-procedure.md` = 177,977 B / 346 lines ⇒ `limit=60` ≈ first 17%, whose
top is frontmatter + `source_count`, not rules. Backfill is (correctly) out of scope, but the
spine change takes effect on the **next container wake** ⇒ asked for it to land after the
backfill, or to say "TL;DR if present, else widen" so it degrades instead of under-reading.

## Confirmed clean (no action)

- Change 3 safe: `All learnings (chronological)` appears **once** in base (the removed
  `_write_index` line), nothing parses it; non-zero control on the same ref confirms the grep works.
  Live `wiki/index.md:93` is regenerated output, not a reference.
- `concepts/` survives `build()` (the `concepts_dir` exclusion is correct).
- 40 KB cap well-sited vs szihs's measured ~56 KB loss threshold.
- Report-don't-rewrite for `OVERSIZE`/`NO-TLDR` is right — splitting is a synthesis decision.

⚠️ **The fenced `SKILL.md` block is NOT byte-identical to the deployed
`/workspace/shared/.learnings_wiki.py`** (14,108 vs 16,590 B, different sha256). The wipe
behavior is present in **both**, so the finding holds — but never assume the fence == the live
script. See [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]].

## Outlives this PR

`slangpy-pr-approver` attests **SHA-256** over `review-approver-decision-procedure.md` (178 KB)
and `review-approver-challenger-calibration.md` (180 KB) — pages it has only ever seen 37% / 50%
of. The cap fixes *future* pages, not these two. Flagged, not buried.

RESUME = **szihs answers the persistence question** (or pushes a fix) → re-review. Related:
[[project_learnings_wiki_finalize_recount_recipe_stale]],
[[project_shared_learnings_duplicate_h1_generator_defect]].
