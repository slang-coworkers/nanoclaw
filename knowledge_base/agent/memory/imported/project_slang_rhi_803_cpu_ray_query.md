---
name: project_slang_rhi_803_cpu_ray_query
description: "slang-rhi#803 CPU ray query (WeakKnight) — approver R3 ABSTAIN_POLICY (CLAUSE_FAIL:tier_eligible) @86f79f6: 3,391 additions / 0 deletions > 2,000 cap, all hand-written code. Feature compiles out under pinned Slang (slang-cpp-ray-query.h 404 at v2026.12.2) ⇒ green CI is zero coverage; gated on OPEN slang#12282. skallweitNV: review deferred pending #12282, and replace the TinyBVH submodule with FetchContent. RESUME v3 (non-bot · addressed to the decision · changes a load-bearing input) or #12282 approved+merged."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# slang-rhi#803 "Add CPU ray query support" (WeakKnight / Tianyu Li)

Fork PR `WeakKnight:cpu-ray-tracing`. Approver runs in shadow mode and posts nothing ([[feedback_approver_never_posts_route_reviewer]]).

## Decision state

**R3 recorded 08-03 17:12Z @ `86f79f6b8e1ad29e73c7ced26a639aa1a9af0c4d` — ABSTAIN_POLICY (CLAUSE_FAIL:tier_eligible), mode `live_late`, 5/6 clauses pass.** A new SHA needs its own ledger row even for a metadata-only clause FAIL (the ledger keys on `commit_sha`). R1's signal was later corrected and the row re-recorded with decision/reason unchanged.

| rev | head | size | note |
|---|---|---|---|
| R1 | `2fc21a3` | 12,724 LOC | included a copied 9,376-line `external/tinybvh/tiny_bvh.h`; fork CI `action_required` ⇒ never ran |
| R2/R3 | `86f79f6` | **3,391 additions / 0 deletions / 14 files** | tinybvh replaced by a submodule gitlink `4431a64a`; CTS oracle fixed |

⭐ **The size cap must be re-tested against the new total, not the delta.** Dropping the vendored blob looks like it should clear 2,000 and doesn't. With deletions at 0 the 3,391 is entirely the PR's own code — a better reason for the same abstain, and it removes any size-exemption argument. Verdict invariant R1→R3 ⇒ a full harvest+Devin re-run is provably non-informative ([[feedback_debounce_approver_dispatch_deterministic_abstain]]).

## Green CI is zero coverage of the new code (mine-verified)

`prelude/slang-cpp-ray-query.h` → 404 at tag `v2026.12.2` (the pin at `CMakeLists.txt:150`) and at `master`; control `prelude/slang-cpp-prelude.h` → 200 at the same tag. Companion **slang#12282 (OPEN)** adds that file. ⇒ `SLANG_RHI_CPU_RAY_QUERY_ABI_AVAILABLE=OFF` (`CMakeLists.txt:486-499`) ⇒ the 1,120-line CPU traversal, `tests/test-cpu-ray-query.cpp` and the CPU CTS cases are **not compiled**. CI at head settled 08-04: 21 check-runs, 20 success + 1 skipped. Textbook [[feedback_green_job_skipped_backend_zero_coverage]]. "CI never ran" was true at R1 and retired at R2 — a reinforcing reason can go stale without moving the verdict.

If the cap ever clears, R2's fallback findings are an unverified must-verify list, and per-symbol gating must be re-checked: `cpu-device.cpp:36` is inside the feature `#ifdef`, but `cpu-command.cpp:336` is unconditional.

## Human state

- **skallweitNV (MEMBER), two issue comments and no review object:** `5164978449` @08-03 10:05Z — back from vacation, has his own TinyBVH prototype, **will not review until the Slang team weighs in on slang#12282**; `5169255880` @16:50Z to `@WeakKnight` — *"we want to keep slang-rhi free from using git submodules. Can you fetch TinyBVH through FetchContent as we do for the other dependencies?"* Assigned 17:22Z (assignees `skallweitNV`, `kaizhangNV`). This would be the repo's first submodule (`.gitmodules` 404 on `main`; the 5 existing `external/` entries are vendored trees); FetchContent precedent exists (13 sites via `cmake/FetchPackage.cmake`, e.g. glfw at `CMakeLists.txt:642,648`). Current wiring hard-fails at `CMakeLists.txt:828-838` if the submodule isn't initialized. Expect another revision; FetchContent will not move the LOC verdict.
- **jkwak-work** reviewed 07-30 (all `COMMENTED`): submodule-not-copy → resolved by `86f79f6`; "where is `slang-cpp-ray-query.h` found?" → answer is slang#12282, author's to reply.
- `issues/803/timeline` shows exactly one relevant event (cross-reference from slang#12282), zero `connected` ⇒ the 3-endpoint scan keyed on 803 is complete. Re-check if a same-repo `Fixes #N` is added.

## CodeRabbit's findings on the merits (never reached the approver's R1 input)

Review `4816225157` @`2fc21a3` carried 11 inline findings (2 🟠 Major, 3 🟡, 6 🔵), all on `pulls/N/comments` while the review body held only boilerplate — the harvest endpoint-split bug, audited in [[project_approver_endpoint_split_harvest_audit]]. The two Majors:
- `cpu-acceleration-structure.cpp:1110` — `ACCEPT_FIRST_HIT_AND_END_SEARCH` is honored only on the fixed-function opaque-triangle path (`:1099`), so a shader-committed candidate keeps traversing and can be replaced by a farther hit. Author rebutted by deferring to unmerged slang#12282 ⇒ **unfixed; worth a maintainer's eye.**
- `test-ray-query-cts.cpp:410` — two Watertight cases with identical setups but contradictory oracles — fixed in R2.

Three findings remain rebutted-not-fixed (incl. the null-guard at `cpu-command.cpp:328`). CodeRabbit's `!external/**` path filter excluded `external/tinybvh`, so the contested submodule change got zero bot scrutiny.

## RESUME triggers (v3)

v1 ("non-bot actionable review") could never fire on a stateless issue comment; v2 ("actionable non-bot feedback in any of the 3 endpoints") was already satisfied by the 16:50Z comment ⇒ always-fires. The rule and its test live in [[feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind]]. **v3 requires all three:** (1) non-bot author (`user.type`/`author_association`, never an `endswith("[bot]")` test — [[feedback_bot_login_suffix_filter_breaks_under_graphql]]); (2) addressed to **the decision**, not to the contributor and not our own bot's output; (3) changes a load-bearing input (LOC total, the ABI header, CI, a standing verdict). Scan all three endpoints (`pulls/{n}/reviews` · `pulls/{n}/comments` · `issues/{n}/comments` — [[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]]); the scan is not the predicate.

Terminal events, with their real gates (08-03: slang#12282 9 reviews / #803 7 reviews, all `COMMENTED`, 0 APPROVED):
- **slang#12282 gets an approving review and merges** ⇒ ABI header ships ⇒ pin bump makes the feature compilable (the big one).
- **#803 gets an approving review** ⇒ merge/close.
- FetchContent rework lands; or the diff drops below 2,000 LOC.
- ⚠️ skallweitNV's bandwidth/design gate is a tripwire that #12282 merging does not clear.

Do not re-dispatch the approver on synchronizes while the total stays >2,000 and no v3-qualifying inbound lands.

## Lessons this chain produced (filed in their keyed homes)

- A timeout is a statement about a past instant — R1 froze `harvest.json` at `pending` 3 min before the review landed and reported without a final re-probe. Re-probe at the last moment before committing the artifact.
- GitHub rewrites inline comments' `commit_id` as the head advances (8 of 11 R1 findings later read R3); only `original_commit_id` preserves provenance. A green bot check is not a harvestable review object.
- A capability probe is a measurement with a timestamp: I called a GraphQL `Bad credentials` fleet-wide and standing; it recovered by 10:12Z without action ([[project_github_actions_graphql_401_outage]]). Say "GraphQL 401'd at <time>; re-probe before relying on it."
- A present-tense claim in a durable row silently ages (the row said "CI mid-flight" ~18h after it settled) — timestamp every observation.
