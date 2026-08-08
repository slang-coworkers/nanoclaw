---
name: feedback_a_bite_check_needs_its_pass_half_or_it_certifies_a_dead_filter
description: "A bite check asserting only 'impossible input → 0' PASSES on a filter that returns 0 for everything. Measured on gh actions/runs: pre-encoded -f gives future→0 (looks correct) and ancient→0 (should be 634). Assert the WIDE case returns the baseline."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35faaf43-6f61-44e5-aa36-55769e43b018
---

⛔ **A "bite check" that only asserts *impossible input → 0* certifies a filter that returns 0 for
EVERYTHING.** The zero it demands is exactly the zero a dead filter produces, so the check passes on the
very defect it was built to catch.

**Measured 2026-08-07** on `repos/shader-slang/slang/actions/workflows/ci.yml/runs`
(`event=merge_group`, `status=failure`; baseline unfiltered = **634**, correct 06-25 window = **145**).
Running the bite check **through the known-broken cell** (`-f` with a pre-encoded `%3E%3D`):

| bite probe | broken cell returns | correct cell returns | verdict |
|---|---|---|---|
| `created>=2030-01-01` (impossible future) | **0** | 0 | ✅ **passes — indistinguishable** |
| `created>=2000-01-01` (ancient, should be everything) | **0** | **634** | ⛔ **caught** |

⇒ The **fail half** (`future → 0`) has **zero discriminating power** — both a working and a dead filter
return 0. Only the **pass half** (`ancient → baseline`) separates them. A bite check stated as *"an
impossible date must return 0"* is therefore **not a control at all**; it is
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]'s "control that fires by luck",
and worse — a **pass** here actively certifies the broken instrument.

⭐⭐⭐ **EVERY filter check needs BOTH halves, and the pass half is the load-bearing one:**
1. **WIDE** — a filter value that should match ~everything **must return the unfiltered baseline**.
2. **NARROW** — a filter value that should match nothing must return 0.
3. **BASELINE** — the same query with the filter clause removed entirely.

Passing (2) alone is what a filter silently dropped by the API looks like. ⭐⭐ **The generalization:
a check whose "healthy" answer equals its "broken" answer is not a check** — before trusting any
control, ask *what would this print if the mechanism were dead?* If the same thing, it is decoration.

**Context — the cell this was built for.** `actions/runs` and `search/issues` **disagree on identical
wrong input**: pre-encoded `%3E%3D` under `-f` yields a loud `422` on search but a **silent
`{"total_count":0}` at rc=0, empty stderr** on `actions/runs`. So the endpoint whose failure is silent
is precisely the one where a one-sided bite check gives false assurance. Encoding rules and the
free-text `created=>=` trap: [[feedback_gh_search_date_filters_fail_three_different_ways]].

⚠️ Also re-confirmed: `-f` **without** `-X GET` POSTs and returns a bare **404** — reads as a deleted
object, not as a wrong method.

⇒ **THE UNIFYING SHAPE of all five traps in this exchange — an absence masquerading as a measurement at
`exit 0`:** `--jq` rendering JSON `null` as an empty line · `--is-ancestor` failing identically for
"not an ancestor" and "object absent from my clone" · unencoded `>=` returning an empty body ·
double-encoded `-f` returning `total_count:0` · a bare line-`grep` missing a phrase that wraps. **None
is caught by checking for an error.** Only a paired control or a baseline catches them.
⭐⭐⭐ **And the meta-tell for which errors survive: the error that CLOSES an investigation is the one
that lives, whether it flatters or self-criticizes** — direction of flattery is incidental; the question
is whether being wrong means you stop looking.
