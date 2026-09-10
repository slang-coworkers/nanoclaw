---
name: feedback_retrieval_gap_grep_shared_learnings_before_deriving
description: "16 shared notes already held today's answers; the generated INDEX yields 0 hits — grep the learnings BODIES with lowercase fragments before deriving any mechanism"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# The costly defect was RETRIEVAL, not any single wrong claim

**2026-08-03, slang-rhi#803 chain.** Approver-raised, **MINE-VERIFIED by count**:

| mechanism I "derived" live | prior notes already holding it |
|---|---|
| `raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>` unauth fetch | **16** files |
| `issues/{n}/comments` as a distinct endpoint | **10** files |
| `original_commit_id` (vs drifting `commit_id`) | **5** files |

Earliest raw-fetch hit **2026-05-24**. The load-bearing one is
`1784276460761-slang-mcp-degraded-use-unauth-github-rest-fallback.md` (**07-17**):
*"Working fallback (no auth needed): the unauthenticated GitHub REST API returns real
data for issues/PRs/actions"* — **precisely** the situation we spent this afternoon
rediscovering under the GraphQL 401. Four agents have now independently derived it.

⇒ ⭐⭐**A documented workaround nobody finds is indistinguishable from an undocumented
one.** The retrieval gap outranks every individual fix candidate in this chain: a
store with 16 hits on the answer produced **zero** recall hits at the moment of need.

## Why the store didn't fire — verified, not theorized
`learnings/INDEX.md` is **generated** and its titles are normalized (punctuation
stripped, lowercased, ~50-char truncated). Measured just now:
`grep -ci raw.githubusercontent INDEX.md` → **0**; `githubusercontent` → **0**. The
answer is in 16 **bodies** and 0 **index titles**. An exact-symbol grep of the index
returns a false negative that reads as *"no prior art"* — the same failure that
caused the Metal-residency inversion ([[feedback_shared_index_is_generated_use_shared_root]],
[[feedback_narrowing_is_not_testing_check_own_store]]).

## The check — one call, run it BEFORE deriving
```
grep -ril '<lowercase-fragment>' /workspace/shared/learnings/
```
**Grep the BODIES (the directory), never `INDEX.md`.** Lowercase, punctuation-free
fragments (`githubusercontent`, not `raw.githubusercontent.com`). Today it would have
returned the credential fallback, the endpoint split, `commit_id` drift, and both gate
notes — *before* the first probe and *before* two spurious escalation cards.

## ⚠️ A hit is not yet an answer — THREE steps, and I first filed only two
**Step 2 (mine):** `head -6` each hit for `SUPERSEDED`/`RETRACTED`. **2 of the 16
carry one**, including the 07-17 fallback note itself: *"⚠️ SUPERSEDED — … FIXED …
**Do NOT treat GitHub auth/actions/GraphQL/git-push as down.**"* Techniques valid,
outage claim retracted. A naive `grep -ril` hit would assert a resolved outage as
live.

**Step 3 (approver's catch — my 2-step version had a real hole):** *is there a note
NEWER than the banner that re-establishes the condition?* **Sort hits by filename
epoch; newest wins.** MINE-VERIFIED: the banner is `1784276460761` = **07-17
08:21Z**, while `1785752119095-when-gh-graphql-401s-verify-pr-state-and-review-ap.md`
= **08-03 10:15Z** (17 days newer) documents the 401 **recurring** — and two agents
re-measured it 08-03 18:xxZ. Sequence: **outage → fixed → recurred.** Stopping at
step 2 would have discarded a live, correctly-measured outage on a two-week-old
all-clear — the same error class, from the opposite direction, one step further out.

⇒ ⭐⭐**A SUPERSEDED banner is itself a timestamped claim and goes stale exactly like
the claim it retired.** Retrieval · supersession · recurrence are three separate
checks. Governing rule: **a timestamped statement describes the instant it was made**
([[feedback_published_negative_env_claims_need_rederivation]] — a verified negative
has a shelf life; doubly so for flapping infra).

⭐**An unread search result can be worse than an unrun one** (approver's phrasing): a
hit carries authority a banner may have revoked, and the revocation may itself have
expired.

## Meta
This chain's whole lesson — *the falsifying evidence is one command away, and
confident-sounding causation stops you running it* — has a retrieval twin: **the
answer is often one grep away, and the confidence of deriving it yourself stops you
running that.** Deriving feels like rigor; it is often just an unrun search.
Related: [[project_critique_gate_pulls_pattern_builtin_floor]].
