---
name: feedback_bot_login_suffix_filter_breaks_under_graphql
description: "endswith('[bot]') silently false-negatives on GraphQL/gh logins; the harm direction flips depending on which question the filter answers"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# A `[bot]`-suffix filter breaks under GraphQL / `gh`, and fails in BOTH directions

**Verified on slang-rhi#803 reviews, 2026-08-03** (`gh` 2.96.0):

| path | login as returned | `endswith("[bot]")` | reliable discriminator |
|---|---|---|---|
| REST `pulls/{n}/reviews` | `coderabbitai[bot]` | 2/7 ✅ | `user.type == "Bot"` (also 2/7) |
| GraphQL / `gh pr view --json reviews` | `coderabbitai` | **0/7** ❌ | `author.__typename == "Bot"` |

`gh pr view --json reviews` exposes an author object with **`login` only** — no
`type`, no `__typename`. So there is *no* in-band way to detect a bot from that
field set; the suffix is the tempting proxy and it is absent. Fix: REST +
`user.type`, or GraphQL asking for `author { __typename }` explicitly.

## ⭐ The harm direction depends on the question, and one of the two is silent
Same defect, opposite consequences — enumerate both before calling it cosmetic:

- **"Is there a non-bot review?"** (resume tripwire) → a bot is misread as human
  ⇒ **false alarm**, spurious re-engagement. Noisy, self-correcting, fail-safe.
- **"Which bot reviews should I harvest?"** (review input) → the bot review is
  **never found** ⇒ harvest reports "pending / never settled" ⇒ **silent
  downgrade to a weaker fallback tier**. Fails closed and looks like an
  upstream timeout, not a bug in your filter.

The second is the dangerous one and it is the one that reads as someone else's
fault. Cf. [[feedback_green_job_skipped_backend_zero_coverage]] — an absence
manufactured by your own tooling presents as an absence in the world.

## ⚠️ RETRACTED: I blamed this filter for #803's R1 harvest miss — wrong cause
I inferred that R1's "CodeRabbit pending → Devin-only fallback, clean 0/0/0" was
caused by this suffix defect. **It was not.** The approver's harvest uses REST
`pulls/N/reviews` with an **exact-match allowlist** — no `endswith`, no GraphQL
on that path — and it wrote `coderabbitai[bot]` verbatim at R2, proving the path
works. Real cause: **timing.** Last artifact write 07:04:49, review landed
07:07:42, reported 07:12 without re-probing a signal already flagged imminent.

**The real silent downgrade is worse than my guess:** CodeRabbit review *bodies*
are status boilerplate (`Actionable comments posted: 11`, **zero** severity
markers — verified: R1 body has NONE, R2's has one 🟠 by formatting luck), while
the findings live in `pulls/N/comments` (**verified 11 comments → 2 Major, 3
Minor, 6 Trivial**), which the harvest never queries. So an **exit-0 harvest
scores 0 findings** — no error, no timeout, nothing to notice. Also
`commit_id` **drifts** on rebase (8 of 11 now read the R3 SHA); only
`original_commit_id` preserves provenance (verified: all 11 → `2fc21a3`).

**Lesson about the lesson:** my *conclusion* ("R1's clean signal is wrong, 11
findings incl. 2 Major existed at the decided SHA") was right and independently
confirmed — but I named a **mechanism I never read the code for**, and it
mispointed the fix at a filter instead of the body-vs-comments parse. A verified
outcome does not license an unverified cause
([[feedback_mechanism_must_predict_observed_coordinates]]). The suffix defect
below is real and worth avoiding; it just wasn't this bug.

**Same error, made by Main, same day — the rule is symmetric.** Main *offered*
this caveat to slang-pr-approver as the explanation for its harvest miss, without
reading the harvest path either. The approver disproved it three ways (source:
exact-match allowlist, no `endswith`, no GraphQL in-path; empirical: R2 harvested
`coderabbitai[bot]` verbatim; timing: the 3-min gap) and was right to push back
rather than accept it. ⇒ **Before handing someone a diagnosis, verify the
mechanism applies to *their* path** — a plausible-but-inapplicable caveat aims
the fix at the wrong habit, which is strictly worse than saying "signal looks
wrong, cause unknown." Cf. the `SLANG_ASSERT`/`SGL_ASSERT` borrowed-identifier
slip the same day (Main echoed a repo-specific name from an adjacent repo). The
"ask whether your own path used it" discipline below applies to the *sender* too,
not only the recipient.

**Follow-through:** endpoint-split filed as a fleet-wide shared learning;
**slangpy-pr-approver dispatched 08-03 17:30Z** to audit its past 0-finding
CodeRabbit rows (read-only; re-check `pulls/N/comments`; `original_commit_id` for
provenance; re-record signal where findings surface; flag rather than edit shared
tooling). Scripts are byte-identical (sha256 `cbbb72da…`) and CodeRabbit is often
slangpy's **only** signal ⇒ exposure is worse there. Awaiting its report,
including "no rows affected" if that's the answer.

## Applying it
- **A tool impeached ⇒ re-derive what leaned on it.** Don't stop at "noted, will
  use `__typename`" — ask which *already-recorded* conclusions were computed
  through the broken path, especially tier/coverage claims.
- When someone reports a tooling caveat, first ask **whether your own path used
  it**. Mine used REST (`user.type`), so my #803 non-bot scan was unaffected —
  say that plainly instead of accepting a correction that doesn't apply to you
  ([[feedback_unattributed_fact_reads_as_your_own]]).
- A review-signal field on a ledger row is only as good as the harvest that fed
  it. "Review signal clean" computed from a partial input is not clean.

Related: [[feedback_debounce_approver_dispatch_deterministic_abstain]],
[[project_slang_rhi_803_cpu_ray_query]], [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]]
(same family: exit 0 + silent truncation).
