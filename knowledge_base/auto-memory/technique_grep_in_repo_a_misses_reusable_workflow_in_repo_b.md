---
name: technique_grep_in_repo_a_misses_reusable_workflow_in_repo_b
description: "A grep inside a repo's .github/ returns a confident ZERO when the behavior lives in another repo's reusable workflow (uses: owner/repo/.github/workflows/x.yml@ref). Enumerate workflow FILES and follow every cross-repo `uses:` before claiming no automation does X."
metadata:
  node_type: memory
  type: technique
---

# `grep` in repo A misses the automation living in repo B's reusable workflow

⚠️⭐⭐**EVIDENCE BASE: ONE CASE (2026-08-04). Hold it in proportion.** A rule derived from a single instance has been fitted to exactly one data point — *a hypothesis wearing a rule's clothing* (slang-fixer's formulation). Contrast the multi-instance rules that survived contact today (*publish the count, never the adjective* had three independent instances; *decisive: does the branch exist on my remote?* had one and **inverted on the second**). ⇒ **RE-DERIVE THIS THE NEXT TIME IT FIRES — first, not last.** If a second independent instance confirms it, say so here and delete this banner; if the second case contradicts it, the rule was the artifact of the first.


**2026-08-04, MINE-VERIFIED while checking a slangpy-fixer claim.**

## The false absence
The fixer investigated *"what is requesting reviewers on my bot PRs?"* and ran a correct, thorough grep:
`add-reviewer|requested_reviewers|requestReviewers|addAssignees` across **`slang-rhi/.github/`** →
**zero hits**, plus `.github/CODEOWNERS` = `* @shader-slang/dev` (a *team*, structurally unable to emit
individual-user review requests). Reasonable conclusion: *"no workflow in the repo does the requesting."*

**It was wrong, and the grep was fine.** The behavior lives one repo over:
```
slang-rhi/.github/workflows/pr-maintenance.yml:55
  uses: shader-slang/slang/.github/workflows/pr-board-sync.yml@master
```
That reusable workflow (in **`slang`**) holds **4** `requestReviewers`/`addAssignees` calls and picks
`members[0]` of a sorted maintainer team. ⇒ **The caller repo contains a one-line delegation and none of
the searched tokens.**

## ✅ The check
```bash
gh api repos/<o>/<r>/contents/.github/workflows --jq '.[].name'        # ENUMERATE files first
# then, per file, follow cross-repo delegation:
gh api repos/<o>/<r>/contents/.github/workflows/<f> --jq '.content' | base64 -d \
  | grep -nE 'uses:.*\.github/workflows/.*@'
```
⭐**Enumerate the workflow FILES before grepping their contents** — my own first attempt used a `.jq`
filter that silently returned nothing, and `pr-maintenance.yml` (the delegating file) has an
unremarkable name that no keyword search would surface.

## Rules
1. ⛔⭐⭐**"No automation in this repo does X" requires following every cross-repo `uses:` first.** A
   reusable-workflow call is a **one-line pointer**; the searched vocabulary is entirely absent from the
   caller. This is a **false absence produced by a correct query over the wrong corpus** — same family as
   a shallow clone answering ancestry, `--paginate` returning page one, `ps` blind to peer containers,
   and `check-runs` missing legacy commit statuses. **The tool worked; the corpus was short.**
2. ⭐⭐**A cross-repo delegation makes a defect invisible to the repo that exhibits it and unowned by the
   repo that implements it.** Fixing it means editing `slang` to change `slang-rhi` behavior — worth
   stating explicitly in any escalation, or the operator looks in the wrong place.
3. ⭐**Timeline `actor` reports the TOKEN OWNER, not a decision-maker.** `jhelferty-nv` looked like a human
   maintainer; `GET /users/jhelferty-nv` returns nulls, and the identical one-second triple (assign + two
   review-requests) appears on slang#12336 / #12312 / #12301 — three unrelated PRs over five days.
   ⇒ **Establish agency with a CONTROL ACROSS ARTIFACTS, never from an actor name.** I reported "two
   maintainers engaged" from that field and had to retract it.
4. ⭐⭐**A guardrail can be defeated downstream of perfect compliance.** Coworkers are forbidden from
   requesting reviewers so bot work doesn't ping maintainers; they complied, and the automation pinged
   two maintainers within ~30s anyway, draft status notwithstanding — producing a real cost (a maintainer
   asking another maintainer about a request neither made). ⇒ **When a guardrail's PURPOSE fails while its
   RULE is honored, fix the mechanism, not the behavior** — and don't let a compliant agent absorb it.

Related: [[technique_ps_is_blind_across_sessions_use_ncl]],
[[feedback_shallow_clone_makes_your_head_the_graft_root]],
[[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].
