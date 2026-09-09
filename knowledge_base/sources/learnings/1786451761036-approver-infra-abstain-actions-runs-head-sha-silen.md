---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-11T12:36:01.036Z
---

# [approver/infra-abstain] actions/runs?head_sha= silently returns total_count=0 for an ABBREVIATED sha — the exact query used to decide "is a review bot still running" fails CLOSED-LOOKING

# `actions/runs?head_sha=` requires the FULL 40-char sha; a 12-char one returns zero

**Measured** on shader-slang/slang#12446, same ref, same minute:

```
gh api "repos/.../actions/runs?head_sha=0117d679a351"                    -> total_count=0    <- FALSE
gh api "repos/.../actions/runs?head_sha=0117d679a351e32c2ef8e6a86376cfacb9f8a4e1" -> total_count=13
gh api "repos/.../commits/0117d679a351/check-runs" --paginate            -> total_count=51, fetched=51
```

`check-runs` and `commits/<ref>/status` **do** resolve an abbreviated ref, so the
short sha works everywhere else you use it — which is exactly why this one
endpoint's silent zero is easy to trust. No error, no 404, no warning: a
well-formed `200` with an empty array.

## Why this is decision-critical for the approver

It is the query prescribed for *"is a review bot still running on this head?"* —
the check that distinguishes a **timing race** (review imminent ⇒ WAIT) from a
**genuine skip** (⇒ fall to Devin-only). A false `total=0` reads as *"no runs on
this head at all"*, which looks like the skip case. I read `runs total=0` and had
begun reasoning that no review workflow existed for the new revision; the truth
was `Claude PR Review = completed/success`, with a posted review already on the
head.

⭐⭐⭐ **THE ZERO ARRIVES IN THE COSTUME OF A FINDING.** An empty result set is
a *positive-looking* answer ("nothing is pending — proceed"), so nothing in the
reasoning trips. Compare the sibling defect already in the store: a bare
`--paginate` 401 on page 2 manufacturing `ABSTAIN_INFRA`. Same family: **an
instrument that fails into a plausible answer rather than an error.**

## The catch, which cost one cross-check

`check-runs` on the same ref returned **51** rows. Two instruments over the same
head disagreeing 0-vs-51 is the tell. ⇒ **Never accept a zero from
`actions/runs?head_sha=` alone: corroborate against
`commits/<sha>/check-runs`, and if they disagree, suspect the ref format before
concluding anything about CI.**

Practical rule:

```bash
# Resolve the FULL sha once, from a source that returns 40 chars, and reuse it.
FULL=$(gh api graphql -f query='{repository(owner:"O",name:"N"){pullRequest(number:N){headRefOid}}}' \
        --jq '.data.repository.pullRequest.headRefOid')
[ ${#FULL} -eq 40 ] || { echo "sha not full-length: $FULL" >&2; exit 1; }
gh api "repos/O/N/actions/runs?head_sha=$FULL&per_page=100"
```

`${#FULL} -eq 40` is a free assertion — the same shape as
`total_count == (check_runs|length)` — and it fires *before* the query rather
than after a wrong conclusion.

Note the workspace-naming trap that seeds this: the approver's own convention is
`work/<pr>-<sha12>/`, so a **12-char sha is the value nearest to hand** in every
script and every prompt. The abbreviated form is not a typo; it is the default.
Anything reading a sha out of a workspace path must re-resolve it to 40 chars
before touching this endpoint.

## Generalization

Third instance today of one shape: a page-1 tally standing in for a 95-row set; a
flat `ls` standing in for a tree with subdirs; and now a short sha standing in
for a queryable ref. ⭐⭐⭐ **A NEGATIVE FROM A QUERY WHOSE *KEY* THE ENDPOINT
CANNOT MATCH IS NOT A NEGATIVE.** Before trusting any zero, ask whether the
instrument could have returned non-zero *for this input shape* — and if the same
fact is reachable by a second endpoint, read it there too.
