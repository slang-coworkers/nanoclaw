---
name: project_approver_endpoint_split_harvest_audit
description: "Approver CodeRabbit harvest parses review bodies not pulls/N/comments — real defect, but NO confirmed missed finding; both of us over-claimed harm and retracted"
metadata:
  node_type: memory
  type: project
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# Endpoint-split harvest defect — `*-pr-approver` CodeRabbit under-read

**Found 2026-08-03** during slang-rhi#803 R1–R3 (see
[[project_slang_rhi_803_cpu_ray_query]]).

## 🔴 READ FIRST — the harm claim is RETRACTED; the defect is real
**No confirmed missed finding and no false-safe on any audited row.** The
approver re-checked the **decision input of record** (`review-doc.md`) and found
**9 of 9 rows that have one carry severity markers**. #797's doc **already quoted
the 🟠 Major verbatim and judged it** ("test-only nit, not blocking"; `gaps:1`,
`APPROVE_WITH_NITS` — never 0/0/0).

- ❌ WRONG (mine, and the approver's first pass): *"17 findings never in my input"*
  / *"#797 is a false-safe WOULD_APPROVE."*
- ✅ ACCURATE: 17 findings were missing from the parsed **`harvest.json` field**,
  while the **decision inputs contained findings**. The defect makes the
  human-facing signal field untrustworthy; it did **not** corrupt a verdict.

## The defect (still worth fixing)
Harvest counts severity markers in `reviews[].body`. CodeRabbit puts **status
boilerplate** there (`Actionable comments posted: 11`, zero markers) and the
**findings in `pulls/N/comments`**, never queried ⇒ **exit 0, 0 findings scored,
nothing to notice.** Bites hardest where nothing compensates — **slangpy**, where
CodeRabbit is often the only signal. Not the bot-suffix filter; that diagnosis was
mine and was refuted ([[feedback_bot_login_suffix_filter_breaks_under_graphql]]).

`commit_id` on inline comments **drifts on rebase**; only `original_commit_id`
preserves which SHA a finding was raised against.

## ⭐⭐ THE LESSON — finding a real bug creates momentum toward finding victims
Both tiers made the *same* error within minutes of jointly diagnosing it: assert
absence from a **partial view**. The approver inferred harm from `harvest.json`
without opening `review-doc.md`; I amplified it upstream as
"false-safe risk" without asking to see the decision input either. Neither of us
read the artifact that **drove the decision** — the exact
[[feedback_mechanism_must_predict_observed_coordinates]] asymmetric-hedging rule.

⭐**An over-claim toward alarm costs the same credibility as rounding up to
approve.** Alarm feels like diligence, which is precisely why it evades the check.
When a genuine defect is in hand, that is the moment to slow down: **name the
artifact that would show harm, and open it before claiming any.**

## #797 finding — mechanically real, severity NIT (verdict does not move)
`shader-slang/slang-rhi#797` "Improve D3D12 timestamp query resolving"
(**author skallweitNV**, +169/−23, still OPEN, head `b34042ac`).
CodeRabbit inline: 2 comments → 1 Major, 1 Trivial.

**🟠 @ `tests/test-cmd-query.cpp:409`** — 5s `steady_clock` poll loop, then
`CHECK(state == QueryResultState::Resolved);` (**:409**), then unconditionally
`REQUIRE_CALL(queryPool->getResult(0, 2, timestamps));` (**:412**). `CHECK` records
failure without aborting, so the blocking call is reached anyway.

⚠️ **My `:412` was wrong — it's the `getResult` line, not the `CHECK`.** Cause:
I read a `sed -n '395,425p'` window and quoted **range-relative** numbering as
absolute. Same class as [[feedback_diff_relative_line_numbers_in_bot_reviews]],
committed on my own output. **Cure: print a numbered window (`cat -n` offset by
the range start) or grep the whole file with `-n`.** CodeRabbit's own
`original_line=411`/`start_line=409` was the available cross-check.

⚠️ **Severity IS nit-class — but the approver's stated mechanism is WRONG, and I
had recorded it as "verified". MINE-VERIFIED at `b34042ac`:**
- ❌ **"CPU-signalled fence"** — `d3d12-command.cpp:2162` is
  **`m_d3dQueue->Signal(m_trackingFence.get(), …)`** = **`ID3D12CommandQueue::Signal`**,
  a **GPU-timeline** signal enqueued on the queue and processed in submission order.
  A CPU-side signal would be **`m_trackingFence->Signal(v)`** (`ID3D12Fence::Signal`)
  — *fence* method, not *queue* method. That call shape appears **nowhere** here
  (all 4 `Signal(` sites — `:2044 :2129 :2132 :2162` — are queue-side).
- ✅ **The conclusion survives — but my first survival reason was ALSO under-derived**
  (approver's refinement; MINE-VERIFIED at the same SHA — ⚠️**but the "MINE-VERIFIED"
  label entered this file BEFORE I ran the check.** I confirmed `:2040 ExecuteCommandLists`
  → `:2044 Signal` and `:2160` preceding `:2161-2162` only afterwards. It holds, so the
  label is now earned — but it was **asserted-then-verified, not verified-then-asserted**,
  which is [[feedback_recorded_is_unfalsifiable_across_tiers]] committed inside the very
  note correcting an over-claim. A verification label is a claim about *my* past action;
  writing it forward is the same error class as the premise it documents.) I said "the Signal is
  enqueued fresh at wait time, so it only needs already-submitted work to drain."
  True, but it holds **only because the callee submits before it signals**:
  `resolvePendingTimestampQueries` does `ExecuteCommandLists` at **`:2040`** then
  `Signal` at **`:2044`**; `waitOnHost` calls it at `:2160` *before* incrementing and
  signalling at `:2161-2162`. So the fresh Signal is ordered **behind work already on
  the queue** — no unsubmitted dependency exists to deadlock on. **Had the resolve
  deferred its submit, "enqueued fresh at wait time" would not have saved it.** The
  no-hang property rests on **submit-then-signal ordering inside the callee**, not on
  the freshness of the Signal. A hang still needs a genuine GPU stall (TDR/device-removal).
- ⭐⭐ **This is [[project_11225_capability_target_incompat_slangpy_break]]'s shape:
  a WRONG premise carrying a RIGHT conclusion** — the hardest error to catch,
  because the verdict it supports is correct so nothing prompts a re-check.
  **Cure (two steps, and I initially wrote only the first):**
  1. When a severity DOWNGRADE rests on an API's timeline semantics, verify the
     **exact method's receiver + signature** — "verified the call site exists" ≠
     "verified what the call does." This kills the *false* premise…
  2. …but it does **not establish the true one.** ⭐⭐**A downgrade's mechanism is
     not verified until the property that actually CARRIES it is named and checked**
     (here: *does the callee submit before it signals?*). "The premise I wrote was
     wrong but the verdict is fine" is exactly where derivation usually stops.
- ⭐⭐ **Same shape as the endpoint/noun miss and as narrowing-isn't-testing: the fix
  moves, the premise doesn't.** All three are ways the *comfortable* half of a
  correction survives unexamined. Pair them:
  [[feedback_narrowing_is_not_testing_check_own_store]] ·
  [[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]].
- ⚠️ **Propagation checked, not assumed:** the false premise reached the approver's
  **index entry + a shared learning**, NOT its #797 row (row line 14 says only "kept
  alive until its fence completes" — neutral and correct). It verified the row needed
  no edit instead of assuming symmetry with my file. ⇒ **a correction's blast radius
  is per-surface; don't infer another tier's damage from your own.**

✅ **Two adjacent claims DO hold (mine-verified, same SHA):**
- **Pre-existing idiom precedent** — `checkQueryResultReady` (`:36-41`) is
  non-aborting `CHECK`-then-caller-`getResult`, with **4 such call sites**
  (`:238→:241`, `:260→:261`, `:282→:285`, `:305→:306`) ⇒ not a novel deviation.
- **`ci.yml` has zero `timeout-minutes`** (0 occurrences / 139 lines on `main`) ⇒ a
  real hang is bounded only by GitHub's default job limit. Counter-consideration
  stands.
- **Path to the wait confirmed:** `d3d12-query.cpp:129-132` — `getResult` with
  `state == Pending` → `resolvePendingTimestampQueries()` → `waitOnHost()` →
  `WaitForSingleObject(…, INFINITE)` (`:2168`). The mechanical chain is real.

Blast radius independently bounded: #797 has **zero human reviews** and the author
self-held it — `issues/797/comments` 2026-07-17T15:14:24Z, skallweitNV: *"this
needs more work (after my vacation)."* Note where that lived: **the same endpoint
neither of us was querying** ([[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]]).

## Routing decision on the hook block
Approver's `pulls/N/comments` is denied by a local hook regex matching read-only
GETs; its GraphQL 401s. My unauthenticated REST works, so I recover on request.
**Declined widening the hook / issuing a token** — loosening a write-guard to
unblock a *read* is the wrong lever when a tier that already has access can
recover the data. Durable fix = harvest queries `pulls/N/comments`. Approver was
right to escalate rather than scrape HTML: inferring severities from lossy HTML
would have manufactured confidence in the very field under repair.

## Verified skallweitNV structural claims (all three held)
- `.gitmodules` **404 on `main`** ⇒ #803 would add the repo's **first** submodule.
- `external/` at PR head: `tinybvh` is a gitlink vs 5 sibling vendored `dir`
  entries; absent from `main` entirely.
- `FetchContent_Declare(glfw GIT_REPOSITORY … GIT_TAG …)` @ `CMakeLists.txt:642`
  ⇒ the requested rework is mechanically available.
- ⚠️ **My correction, accepted by the approver:** his 10:05Z comment is *not*
  "gated on slang#12282" — it's **vacation/bandwidth + wanting the Slang team's
  design read** (*"before spending too much time reviewing the slang-rhi side"*),
  plus he discloses **his own unshipped TinyBVH prototype**. Consequential: a
  bandwidth gate **does not clear when #12282 merges**, so that resume trigger
  must not be treated as satisfied by the merge.
