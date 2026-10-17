---
type: project
name: project_slangpy_1001_build_time_kernel_compilation_scrub
description: "slangpy#1001 'Move kernel compilation to build time' departure scrub — CLOSED coworker-side 2026-08-06. Verdict: still relevant, needs a FIRST-TIME owner (never assigned), do not close. Solution section was never written (not truncated); its `slangtorch_library` reference design does not exist anywhere. Awaiting a human roadmap call."
metadata:
  node_type: memory
  type: project
  originSessionId: 59a5d801-d899-4929-873e-3b62abc8646f
---

# slangpy#1001 — "Move kernel compilation to build time" (scrub CLOSED, issue OPEN)

**Ask (2026-08-05):** `jkiviluoto-nv` mentioned `@nv-slang-bot` on
[`5195826585`](https://github.com/shader-slang/slangpy/issues/1001#issuecomment-5195826585): author
`mkeshavaNV` won't return; scrub for relevance, reassignment, or close. Canonical thread
`gh-issue-shader-slang/slangpy-1001`. A real mention, so posting was authorized.

**Coworker-side state: CLOSED 2026-08-06.** The issue stays OPEN, unowned, with no labels or
milestone, waiting on a human roadmap decision. Nothing is owed by us. Live state was last read
2026-08-06; GitHub returned 401 on 2026-10-16, so it was not re-read then.

**RESUME:** any new `issue_comment` on #1001 that asks us something.

## Public record

- Bot scrub `5196939912` (2026-08-05 20:24:53Z), a full 5-bullet verdict posted by a sibling
  session **before** my dispatch. I briefed from a ~18:5xZ read showing `comments: 1` and never saw it
  ([[feedback_a_stale_snapshot_dispatch_duplicates_a_chain_another_leg_already_ran]]).
- `slangpy-triager` delta `5199057817` (2026-08-06 00:39:06Z), posted as a fresh comment, not a
  PATCH of the sibling's comment. It mutated no issue metadata.

## Verdict: still relevant · needs a first-time owner · do not close

- **Never assigned.** The timeline has zero `assigned` events, so "reassign" is the wrong verb. The
  ask is first-time ownership of orphaned design work. The batch's stated reason ("won't be
  returning") is true of authorship and says nothing about assignment. A batch mention's reason is a
  hypothesis about each artifact, and the sibling scrub found it outright false for #820/#821
  ([[project_slangpy_821_empty_body_scrub_cluster]]).
- **No build-time flow exists.** The cache PRs do not fix it:
  - #561 persistent LMDB cache merged 2025-10-10. It predates the issue, which critiques it: cached
    IR paths are unstable under sandboxes and per-invocation build paths.
  - #1036 CacheWriter (2026-06-30) moves cache writes off the foreground path. It is a latency fix.
  - #509/#637 cover precompiled-module loading.
  - #1013 `defer_target_compilation` (tdavidovicNV, 2026-06-03) defers codegen and does not persist
    it.

  A merged PR whose title matches the topic is not a fix until you read what it changed
  ([[feedback_a_candidate_trigger_instance_needs_the_test_not_the_title]]).
- **The Solution section was never written.** The body is 4,054 chars against a 65,536 limit and ends
  at "Any of the following shapes would be sufficient:". My first reading called it "truncated", which
  was wrong ([[feedback_body_ending_early_is_not_evidence_of_truncation]]).
- **`slangtorch_library`, the reference design the issue is premised on, does not exist.** Code
  search returned 0 hits org-scoped and 0 GitHub-wide. The only issue hit was #1001 itself. Controls
  were live: `slangtorch` 50, `slang_library` 6, `loadModule` 654. The triager also found 0 across
  1,644 commits on all refs. Public framing separates the **FACT** (no public `slangtorch_library`)
  from the **HYPOTHESIS** (shorthand for the ninja/`cpp_extension` flow, or an internal wrapper). The
  author question is now "what was the baseline?" rather than "finish your Solution section", which
  others can answer.
- **Not verified by anyone:** the reporter's A40 magnitudes (~3 s / 5 s / 25–75 s per call site, ~7
  min first-process startup). Both tiers confirmed the mechanism only. `slangpy/benchmarks/ppisp/`
  measures steady state with warmup, so **cold-start cost has no CI regression guard**.

HEAD pointers (`device.h:157`/`:162`, `device.cpp:98-118`; the standing comment's `device.cpp:363-364`
is a miscite), the PR ordering and the A/B/C approach list are in
[[project_slangpy_1001_triager_memo_verbatim]].

## The orphaned cluster

`mkeshavaNV` left ~39 open items across slang and slangpy, not the 8 a slangpy-only search returned
([[feedback_a_count_is_only_as_wide_as_its_querys_scope]]). slangpy: #1001, #899, #822/#821/#820, #768,
#510, and stale draft PR #904. Sibling sessions own the rest of the cluster.

## Lessons this chain produced (held in their own leaves)

- I wrote "Routed to `slangpy-triager`" before the `send_message` fired, and a restart landed in
  between. This was the third instance in ~24 h. Dispatch `17` was made real 2026-08-06 →
  [[feedback_a_memo_is_not_a_receipt]].
- GitHub's issue search does not reliably index comment bodies. It returned `total_count 0` for a
  comment I could read, so a zero from a search index is not an absence in the data.
- An issue's `updated_at` is not evidence its author is active. The recent updates were the sweep's
  own bot comments.
- The triager's first `git log --all -S` ran in `/tmp`, and target and control both returned 0. Its
  control caught it → [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
- Negative existence claims need a rederivation with live controls →
  [[feedback_published_negative_env_claims_need_rederivation]].
- Never patch a sibling session's comment under a shared bot identity, and edits notify nobody →
  [[feedback_an_in_place_edit_notifies_nobody]].
- [[feedback_a_reporters_framing_is_a_hypothesis_not_a_finding]].

Related: [[project_6519_precompiled_reflection_scrub_closed]],
[[project_6542_nested_parameterblock_precompile_ice]].
