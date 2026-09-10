---
name: slangpy-1072-profiler-drain-snapshot-race
description: "slangpy#1072 profiler drain() snapshot-order race finalizes empty frames. The one-line reorder was a THIRD of the answer: author found flush() barriers only 1 of 3 channels; reviewer found the regression guards were doctest::skip()-disabled; codex found a pre-existing permanent-wedge in end_zone. Keeper: present/passing ≠ exercising."
metadata:
  node_type: memory
  type: project
  originSessionId: 1f98e769-cee1-48cb-a375-95117b083d43
---

# slangpy#1072 — profiler drain() snapshot-order race (author jkwak-work, maintainer)

P1 CI flake in SGL C++ `src/sgl/utils/profiler.cpp`, introduced by newly-landed profiler PR #1063. **NOT
upstream-Slang.** Fixed in PR **#1073** (`Fixes #1072`), which grew from a 14-line reorder into a flush()
barrier redesign + a pre-existing-wedge fix; peer-approved APPROVE_WITH_NITS, awaiting human merge.
Canonical thread `gh-issue-shader-slang/slangpy-1073`.

## The bug, and why the reported fix was a third of the answer

**Root cause:** `ProfilerImpl::drain()` snapshots per-thread zone queues BEFORE snapshotting
`sealed_frame_events` (~`profiler.cpp:739-765`). A zone published+sealed in the unlocked window between the
two snapshots gets its frame finalized empty → nondeterministic frame stats. Thread-count-*independent*
(collector runs async; `pending_gpu_count` bumped only when a CPU zone event is consumed). Two CI repros
(macOS ARM64 Debug cross-thread; Windows Debug device-close). **Reorder fix (Approach A):** snapshot the
sealed-frame vector first, then the queue acquire-loads, keeping consume-zones-before-frames — closes the
#1072 *symptom* but cannot make `flush()` wait for a side-channel event.

⭐⭐ **WHAT ACTUALLY CLOSED IT — worth preserving:** NOT the reorder. It was (1) author @skallweitNV catching
that `flush()` has **three collector input channels but only one participates in its barrier** (records only
each thread's ring `write_index`; neither `sealed_frame_events` nor `pending_gpu_results` participates), so
the impl does not meet its documented contract at `profiler.h:476`; and (2) the reviewer catching that the
"existing regression guards" were `doctest::skip()`-disabled (deferred by #1076 to this PR) and **never
running**. ⇒ **a fix that is green, peer-approved, and CI-clean can still be a third of the answer.**

**The full fix** = suggestion 1 (published/consumed watermarks for the two side channels, folded into
`flush()` completion; GPU counters advance on **publication** only so flush never waits on unresolved
queries) + suggestion 2 (explicit frame completion: expected published-zone count stamped at seal;
`finalize_ready_frames()` gates on `zones.size() >= expected && pending_gpu_count == 0`) + re-enabling the
two #1076 tests. **Three deadlock-avoidance design constraints** on the drop/overflow paths, each a genuine
trap: (a) GPU watermark covers already-**published** results only; (b) expected count tracks `push()`
**SUCCESSES**, not attachments (`push()` drops on ring-full while `end_zone` discards the return and still
releases the frame count — an attachment-based count would stall finalization forever); (c)
`bound_pending_frames()` must clear the expectation on window-overflow force-complete.

## The end_zone defect cascade (A pre-existing; B, C, D introduced fixing it)

Adversarial CODE_REVIEW (codex) then found four real defects on the same `end_zone` surface — **every one
caught before a human saw it, none by a passing test:**

- **(A) PRE-EXISTING PERMANENT-WEDGE (in the author's code, not the fixer's).** `end_zone` returns early on
  a zone-stack/correlation mismatch, but `begin_zone` already called `attach_zone_to_global_frame`. The
  early return **skips `release_zone_from_global_frame`** → reference leaks → frame never seals → every
  subsequent `begin_frame` is rejected. **One out-of-order `end_zone` permanently wedges global-frame
  profiling** (strictly worse than #1072's dropped statistics). Uncatchable by existing coverage: the "zone
  stack overflow drops only the excess zone" test exercises the mismatch path but **never calls
  `begin_frame`**, so `frame_index == INVALID_INDEX` and the leak cannot manifest. Wants its own tracking
  issue so it doesn't die with #1073.
- **(B) double-release → corruption.** Releasing on *every* mismatch let the same reference release twice
  (re-presenting a token satisfies the valid path) → `release` underflows the packed zone count in release
  builds. Fix: use the thread's zone-stack slot as ownership marker; `correlation_id` is never 0 (high 32
  bits are `timeline_id + 1`) ⇒ 0 is a safe "already released" sentinel.
- **(C) phantom stack slot.** Zeroing a non-top slot left an entry `zone_depth` still counts → burns one of
  64 slots per out-of-order end. Fix: `release_finished_zone_slots()` pops zeroed top slots on both paths.
- **(D) the (C) test was VACUOUS.** It asserted `parent_index == -1` — which passed with the (C) fix fully
  neutered, because the (B) fix had already zeroed `zone_stack[0]`. Rewritten to measure the actual capacity
  leak (open 64 zones after the out-of-order pair, assert `zone_count() == 65`).

## The verification generalizations (the real transferable output)

- ⭐⭐ **"present" and "passing" are not "exercising."** A skipped test, a stale binary, and a vacuous
  assertion are three disguises for one bug. The single check that catches all three: **name the defect,
  then name the assertion that fails when *only* that defect is reintroduced** — otherwise you have
  coverage-shaped nothing.
- ⭐⭐ **A positive control proves a test CAN fail; it does NOT prove it fails for the RIGHT reason.** The (D)
  control passed on a test whose assertion was blind to the bug — the build subagent's move, *control the
  control*, is what caught it. Corollaries: **a prior fix in the same code can strip the discriminating
  power of the obvious assertion** (B zeroing `zone_stack[0]` made `parent_index` unable to distinguish C
  fixed-vs-broken); **verify a counter's aggregation before asserting on it** (`producer_drop_count` sums
  `stack_overflow_count`, so a would-be `== 0` assertion could never hold). Run **one control per hazard**,
  each failing its own target test, and re-fire earlier controls after a later fix.
- **For any number you publish, name how you obtained it.** `sizeof(CpuEvent)` was corrected 56→64 B
  (wrap-reachability off by ~1000×, conclusion unchanged) — "estimated from the field list" and "printed by
  a probe compiled against HEAD" are different epistemic states, and *robust-to-being-wrong-by-888×* is
  precisely the condition under which a bad number is never challenged.
- **Build-system trap (captured as a shared learning):** `cmake --build --preset linux-gcc-debug` does NOT
  relink `sgl_tests` — a **stubgen failure aborts ninja BEFORE the link**, so the stale binary keeps passing.
  Build with `--target sgl sgl_tests` + a mandatory mtime-vs-baseline relink proof. A 07-24 stale binary
  passed the cross-thread test in the worktree — same family as the zero-that-can-be-nonzero trap.
- The adversarial pass earned its cost: **4 defects (3 the fixer's own) + 2 vacuous tests + 1 masking test**,
  ~30 critique rounds, none caught by a green run. The argument FOR the gate. See
  [[feedback_green_job_skipped_backend_zero_coverage]].

## Operational lessons (chain-driving; filed in siblings)

- **Mid-turn teardown does NOT self-heal.** The fixer died on `API Error: timed out` mid-implementation; the
  host's bounded-backoff redrive covers **inbound handoffs**, not in-container mid-turn work — that strands.
  But **worktrees outlive the session**: uncommitted edits survived on disk, so the re-dispatch framing is
  "check your worktree, commit whatever survived, then resume," not "assume lost." After any coworker
  API-Error, verify (1) does a session still exist on the thread, (2) did anything get pushed. See
  [[feedback_in_session_monitors_dont_survive_teardown]].
- **A GH_TOKEN 401 scoped to one container is the operator credential-refresh class, not a restart** —
  discriminate scope (Main's own token read GitHub fine) before escalating; verify your own capability before
  offering to proxy a blocked write. A **capability-negative you keep restating needs re-probing each round**:
  the 401 write-block was asserted live six times after it had cleared at 17:10 (a landed comment is cheap to
  check). See [[feedback_published_negative_env_claims_need_rederivation]], [[project_github_actions_graphql_401_outage]].
- **Debounce approver dispatch on churn; liveness reads from the pushed head, not the session list**; a green
  `ci` on a **superseded** head is not a verdict input (the phantom-green trap — no cancelled/superseded run
  in the window carried correctness information); a debounce must re-evaluate its own cap rather than hold
  silently. See [[feedback_debounce_approver_dispatch_deterministic_abstain]], [[feedback_debounce_pr_review_on_churn]].
- **Don't hand over or echo a repo-specific identifier without grepping the target tree** — slangpy uses
  `SGL_ASSERT`, not `SLANG_ASSERT`; a learning filed under the wrong owner points the fix at the wrong habit,
  and the at-risk habit belongs to whoever holds both repos' conventions in context.

## RESUME / status

Chain complete, peer-approved (round-2 APPROVE_WITH_NITS, 0 bugs), CI 14/14 on `34226ac79e` across all
platforms incl. macOS + Windows (exactly where #1072 originally failed), awaiting human merge only. The
re-enabled #1076 tests remain **corroboration, not proof** (timing-dependent); the deterministic tests + the
completion rule are the real argument. Two open threads for the maintainer: the correlation-id-never-0
premise (offer `SGL_ASSERT` at the construction site vs. restructure — his protocol call), and defect (A)
wants its own tracking issue. Follow-up **#1077** (re-enable the disabled tests) is doubly-gated on #1073 +
#1076 merging and is HELD; see [[project_slangpy_1076_branch_protection_review_gate]].
