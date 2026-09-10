---
name: feedback_inbound_scan_must_cover_issue_comments_not_just_reviews
description: A maintainer directive can arrive as a plain issue comment with no review object; a reviews-only inbound scan structurally cannot see it
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# The inbound scan must query `issues/{n}/comments`, not just `pulls/{n}/reviews`

**slang-rhi#803, 2026-08-03.** My debounce rule already said *"scan for non-push
inbounds — this is its real load-bearing job"*
([[feedback_debounce_approver_dispatch_deterministic_abstain]]). I implemented it
as `GET pulls/803/reviews` and reported **"all COMMENTED, no CHANGES_REQUESTED,
no human blocker."** True, and misleading. The actual blocker had no review
object at all:

- `issues/803/comments` @ **2026-08-03T16:50:10Z**, **skallweitNV** (the assigned
  slang-rhi maintainer): *"we want to keep slang-rhi free from using git
  submodules. Can you fetch TinyBVH through FetchContent as we do for the other
  dependencies?"*
- `issues/803/comments` @ 2026-07-30T17:23:05Z, **jkwak-work**: *"I am not
  familiar with slang-rhi enough to approve. Assigning to @skallweitNV."*

Both are **plain conversation-tab comments**. `reviews[]` count stayed 7 and
every state stayed `COMMENTED` — a reviews-only scan cannot see either, at any
polling frequency. The PR's `updated_at` (16:50:10Z) **equals** the blocking
comment's timestamp: the synchronize webhook I was debouncing was *that comment*
touching the PR, not a push. The head hadn't moved since 07-31T14:25Z.

**Consequence:** R3's recorded fact "no standing blocker" was wrong at record
time, and the submodule approach the row treats as settled is the thing the
maintainer rejected — a **direct reversal of jkwak-work's earlier "make it a
submodule" ask**, which the author had already implemented. Two maintainers,
opposite instructions; only the second is current.

## ⭐⭐ A REVIEW-STATE PREDICATE CANNOT FIRE ON STATELESS FEEDBACK
Fixing the endpoint list is necessary but not sufficient — **the resume condition's
grammar was also wrong.** I wrote the #803 trigger as *"a non-bot actionable
**review**"*. skallweitNV's FetchContent change request arrived as an
`issues/803/comments` post with **no review object and no state**, so `reviews[]`
stayed 7/all-`COMMENTED` — a review-state predicate reports "clean"
**indefinitely** while a live change request stands. Widening the endpoints while
leaving the predicate keyed on review state re-opens the same hole.

✅ Correct form: **"actionable non-bot feedback in ANY of the three endpoints"** —
`pulls/{n}/reviews` · `pulls/{n}/comments` · `issues/{n}/comments`.
❌ Anti-pattern: any trigger whose subject is "review" / whose test is a `state`
field. Authority is in the **person**, delivery is incidental.

**Generalizes:** when a rule is corrected, re-read the *condition you wrote* for
the same defect class you just fixed in the *implementation*. I patched the
endpoints and left the noun — cf. the standing lesson that a stated rule can't
reach the write site, and [[feedback_correction_must_sweep_whole_file]] (a
correction appended ≠ applied).

## Rules
- **Inbound scan = `pulls/{n}/reviews` AND `pulls/{n}/comments` AND `issues/{n}/comments`.** A review
  object is one delivery mechanism for a human decision, not the mechanism.
  Authority lives in the *person*, not the API shape. The issues timeline
  (`issues/{n}/timeline`) covers both plus assignment events.
- **A directive can arrive with `state: COMMENTED` or no state at all.**
  `CHANGES_REQUESTED` is a UI affordance maintainers often skip; "can you do X
  instead" in a comment is a blocker. Cf.
  [[feedback_changes_requested_read_body]] (the converse: `CHANGES_REQUESTED`
  may not be an edit list).
- **When a synchronize fires and the head has NOT moved, the trigger was
  something else — go find it.** Diffing heads and stopping is how a
  comment-triggered event gets silently absorbed. `updated_at` matching a
  comment timestamp is the tell.
- **A later maintainer can reverse an earlier one.** Don't treat a resolved
  review thread as durably settled; re-read who owns the area now (here:
  jkwak-work explicitly handed review to skallweitNV).

## ⭐ Meta-lesson: I wrote this rule and then under-implemented it
The rule named the *goal* ("scan for non-push inbounds") but my habit supplied
the *endpoint* (`pulls/reviews`, because that's what caught #802's
CHANGES_REQUESTED). A rule stated as an intent gets executed as whatever the
last instance looked like. **Write resume checks as concrete commands with the
endpoints enumerated**, or they degrade to the previously-seen shape —
[[feedback_name_what_you_held_fixed]], and the standing note that a stated rule
can't reach the write site.

Related: [[project_slang_rhi_803_cpu_ray_query]],
[[feedback_bot_login_suffix_filter_breaks_under_graphql]] (same session: my
mechanism there was refuted while the conclusion held — see
[[feedback_mechanism_must_predict_observed_coordinates]]).
