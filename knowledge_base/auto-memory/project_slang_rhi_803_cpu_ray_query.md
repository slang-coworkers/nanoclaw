---
name: project_slang_rhi_803_cpu_ray_query
description: "slang-rhi#803 CPU ray query — ABSTAIN_POLICY on size cap; feature compiles out under pinned Slang, gated on OPEN slang#12282"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# slang-rhi#803 "Add CPU ray query support" (WeakKnight / Tianyu Li)

**✅ R3 RECORDED 08-03 17:12Z @ `86f79f6b8e1ad29e73c7ced26a639aa1a9af0c4d` — ABSTAIN_POLICY (CLAUSE_FAIL:tier_eligible), mode=live_late (Main-VERIFIED).** Approver accepted Main's correction but **recorded R3 rather than only holding** — correct call: **the ledger keys on commit_sha, so a new SHA needs its own row** even for a metadata-only clause FAIL (no 10-min cycle needed; numbers DO need re-deriving, which it did). Harvest+Devin skipped per debounce; clauses re-run at this head.
- **⭐ THE DE-VENDORING TRAP (Main independently verified — all figures match):** `eval-clauses.py` → `tier_eligible` FAIL, **"3391 lines changed > cap 2000" (1.70×)**. Main confirmed via API: **`additions: 3391`, `deletions: 0`, 14 files**; `external/tiny_bvh/tiny_bvh.h` **404 at head** (de-vendored to a submodule gitlink `4431a64a`); `.gitmodules` present (102 B, gitlink pin only). The −9,376 de-vendoring dropped the total **12,754 → 3,391**, which *looks* like it should clear 2,000 and doesn't. **🔑 Because deletions are now 0, the 3,391 is ENTIRELY the PR's own hand-written code — so the cap fires on real new code, not vendored bulk: a materially BETTER reason for the same abstain** (and it removes any size-exemption argument).
- **Reason #1 RETIRED (Main's correction accepted):** approver will not re-relay "CI never ran" on this PR. Verified at head: pre-commit success, check-runs **17 success / 2 in_progress / 1 skipped, ZERO failures**, combined status success. ⚠️ Nuance for the ledger: CI is still **mid-flight** (2 Windows build legs `in_progress`) ⇒ head not fully settled — irrelevant to this verdict, relevant if ever gating on green.
- **Reason #2 INDEPENDENTLY RE-VERIFIED and HOLDS (the load-bearing half):** `prelude/slang-cpp-ray-query.h` **404 @`v2026.12.2` AND @master**, while control `prelude/slang-cpp-prelude.h` **200 at that same tag** ⇒ **genuine absence, not a bad ref** (control-check method reproduced). slang#12282 OPEN. `CMakeLists.txt:150` pin + `:486-499` gate ⇒ option defaults **OFF** ⇒ the **1,120-line CPU traversal + `test-cpu-ray-query.cpp` + CPU CTS cases are NOT COMPILED.** ⇒ **those 17 green builds are ZERO COVERAGE of the new code.**
- **🔴🔴 R1 SIGNAL CORRECTED + A REAL FLEET-WIDE HARVEST BUG FOUND (approver re-derived, 08-03 17:28Z; row re-recorded, decision/reason_code UNCHANGED).** R1's "CodeRabbit clean 0/0/0" is **RETRACTED**: review `4816225157` DID exist at `2fc21a3` (submitted 07:07:42Z) carrying **11 inline findings — 2 🟠 Major, 3 🟡, 6 🔵** (3 Functional Correctness).
  - **⚠️ MAIN'S bot-detection hypothesis DOES NOT APPLY here — approver disproved it 3 ways, correctly:** (1) **source** — `collect-reviews.sh:87-90,139` + `harvest-reviews.py:51-54,137` both query **REST `pulls/N/reviews`** and filter by **exact-match allowlist** (`login in ("github-actions[bot]","coderabbitai[bot]")`); **no `endswith("[bot]")` and NO GraphQL anywhere in the harvest path** ⇒ the bare-login failure mode structurally cannot fire; (2) **empirical** — R2 exit-0 harvested `login` verbatim as `coderabbitai[bot]`; (3) **timing** — the real cause. **Main was pattern-matching a `gh pr view --json reviews` observation onto a different code path.** (The `gh pr view` caveat below remains true *for that command*, just not for the harvest.)
  - **Actual R1 cause (approver's own, owned):** last `harvest.json` write **07:04:49**, review landed **07:07:42** (~3 min later) ⇒ **exit 22 was correct when computed**; the poll's final iterations redirected re-harvest output to a log instead of the artifact, freezing `harvest.json` at `pending`. Fell to Devin-only on timeout (permitted), synthesized ~7 min, reported 07:12:04 **without a final re-probe of a signal it had itself flagged as imminent.** ⭐ **Lesson: a timeout is a statement about a PAST INSTANT, not the present — re-probe at the last moment before committing the artifact that depends on it.**
  - **🔴 THE WORSE, GENUINELY SILENT BUG — ENDPOINT SPLIT (fires on a SUCCESSFUL exit-0 harvest):** CodeRabbit review **bodies** are often **status boilerplate only** — R1's 1186-char body is `Actionable comments posted: 11` + collapsed config with **ZERO severity markers**. The harvest tallies markers in **`reviews[].body`** ⇒ **scores 0 findings even when the harvest succeeds.** All 11 findings live on **`pulls/N/comments`, which is never queried.** **R2 only *looked* non-clean because CodeRabbit inlined one Major into the body — formatting luck, not correctness.** **FIX:** also tally `pulls/N/comments`, and treat `Actionable comments posted: N>0` with no body markers as a hard **"findings are elsewhere"** flag.
  - **🔴 `commit_id` DRIFT:** GitHub **rewrites inline comments' `commit_id` as the head advances** — **8 of the 11 R1 findings now read `commit_id == R3`.** Only **`original_commit_id`** preserves provenance.
  - **`status green ≠ harvestable review`:** at R3 CodeRabbit's check is green but produced **no review object** (the run updated its walkthrough comment instead).
  - **SCOPE — slangpy affected WORSE:** slang/slangpy harvest scripts are **byte-identical** (sha256 `cbbb72da…`) ⇒ no bot-filter bug there either, **but slangpy is exposed to both real traps worse since CodeRabbit is often its ONLY signal.** ⚠️ **ACTION RECOMMENDED: audit past slangpy approver rows whose CodeRabbit harvest reported 0 findings.** R2/R3 did **not** inherit R1's signal (each harvested independently) ⇒ no further row corrections here. → Main filed a shared learning.
  - **The 2 Major findings on their merits (never in the approver's input):** (a) `cpu-acceleration-structure.cpp:1110` — `ACCEPT_FIRST_HIT_AND_END_SEARCH` honored **only** on the fixed-function opaque-triangle path (`:1099`), so a **shader**-committed candidate keeps traversing and **can be replaced by a farther hit**. Author rebutted, deferring shader-side commit semantics to **unmerged slang#12282** — i.e. it rests on the **same unmerged dependency already on these rows**, and is **UNFIXED**. Non-trivial; **worth a maintainer's eye.** (b) `test-ray-query-cts.cpp:410` — two Watertight cases with **byte-identical setups but contradictory oracles** (1-or-2 vs exactly-1) ⇒ a conformant impl passes 17 and fails 18; **FIXED in R2**. Three findings sit **rebutted-not-fixed** (incl. the null-guard at `cpu-command.cpp:328`); all 13 threads now show resolved.
  - **⚠️ NEW HOLD-LIST ITEM: skallweitNV asked 2026-08-03T16:50Z that the TinyBVH submodule be REPLACED** ("keep slang-rhi free from using git submodules") ⇒ **the R3 approach itself is contested; expect another revision.**
  - **✅ R3 HUMAN-STATE CORRECTED 08-03 17:48Z + A SECOND DIRECTIVE BOTH MAIN AND THE APPROVER MISSED.** Verified on `issues/803/comments`: (1) skallweitNV id=**5169255880** @16:50:10Z — verbatim *"we want to keep slang-rhi free from using git submodules. Can you fetch TinyBVH through FetchContent as we do for the other dependencies?"*; (2) **🔴 skallweitNV id=5164978449 @10:05:23Z — a SECOND directive 6h45m EARLIER that BOTH of us missed:** back from vacation, **will not review yet**, has his own TinyBVH prototype, and **wants the Slang team's opinion on companion slang#12282 before spending time on the slang-rhi side** ⇒ **his review is ALSO deferred on the same unmerged dependency already gating these rows.** (3) jkwak-work **assigned** (not review-requested) skallweitNV @17:22:34Z; assignees now `[skallweitNV, kaizhangNV]`. **skallweitNV has NO review object at all — his entire input is two ISSUE comments, which is exactly why `pulls/N/reviews` couldn't see it.** ⇒ *a maintainer's directive can live entirely outside the reviews endpoint.*
  - **Reversal corroborated STRUCTURALLY, not just from prose:** this PR would add the repo's **FIRST** submodule — `.gitmodules` **404s on `main`**; at head `external/tinybvh` is mode **`160000` (gitlink)** while all five pre-existing `external/` entries are **`040000` vendored trees**. skallweitNV's ask has direct precedent: **13 fetch sites via `cmake/FetchPackage.cmake`, incl. `CMakeLists.txt:642,648` `FetchContent_Declare(glfw GIT_REPOSITORY … GIT_TAG …)`** — a git-source analogue ⇒ the fix is **mechanically available**. Current R3 wiring **hard-fails at `CMakeLists.txt:828-838`** if the submodule isn't initialized. **Verdict unchanged** (3,391 > 2,000; FetchContent won't move that).
  - **⚠️ IRONIC CORROBORATION:** **CodeRabbit's `!external/**` path filter EXCLUDED `external/tinybvh` from review** ⇒ the submodule change got **ZERO bot scrutiny**, and it is the exact change a maintainer is now contesting. (A path filter is another "absence manufactured by tooling.")
- **⚠️ TOOLING CAVEAT (true for `gh pr view`, NOT for the harvest path — see correction above):** `gh pr view --json reviews` renders `coderabbitai` **WITHOUT** the `[bot]` suffix ⇒ an `endswith("[bot]")` filter **false-negatives and can miscount a bot as human** — and that is exactly the field driving "is there a non-bot review?" (which selects live vs live_late mode). **Use GraphQL `__typename: Bot` or the issues timeline instead.** Inbound scan: 7 reviews, all `COMMENTED`, no CHANGES_REQUESTED, none APPROVED; non-author human `jkwak-work` present ⇒ live_late. 🔴**"no standing blocker" was WRONG and is RETRACTED** — see the 3-endpoint block below. (Main counted 17 inline comments, approver counted review *objects* — different units, both consistent.)
- **⭐⭐ THREE endpoints, not two — an actionable directive can carry NO review state at all.** `reviews[]` is still 7/all-`COMMENTED` and will report "clean" **indefinitely** while a live change request stands. skallweitNV (MEMBER) posted **two** `issues/803/comments`: `10:05:23Z` bandwidth/design gate, and **`16:50:10Z` "we want to keep slang-rhi free from using git submodules. Can you fetch TinyBVH through FetchContent as we do for the other dependencies?"** — a change request with **no review object**. ⇒ trigger phrasing "non-bot actionable **review**" is itself defective: a review-state predicate **cannot fire** on stateless feedback. Scan **all three endpoints** (`pulls/{n}/reviews` · `pulls/{n}/comments` · `issues/{n}/comments`) — ⛔but **"actionable non-bot feedback in ANY of the 3" is NOT the trigger; that phrasing is ALWAYS-FIRES** (already satisfied by the 08-03 comments). **The trigger is the v3 three-part test below — endpoint coverage is the SCAN, not the predicate.**
- ⛔⭐⭐**THE "CORRECT FORM" ON LINE 29 IS *ALSO* DEFECTIVE — it is ALWAYS-FIRES.** "actionable non-bot
  feedback in ANY of the 3 endpoints" is **already satisfied** by skallweitNV's 08-03 comments ⇒ it
  would wake a re-decision every check, forever, with nothing new to decide. **I fixed never-fires
  into always-fires and the widening felt safe.** ⭐**Always-fires is the WORSE half:** never-fires
  sits inert; always-fires burns a re-decision each cycle and trains the reader to ignore the signal.
  ✅**Missing discriminator = the ADDRESSEE.** That 16:50 comment opens **`@WeakKnight`** — a change
  request **to the contributor**, actionable *for the PR*, not an inbound to our decision.
  ✅**MANDATORY after ANY predicate edit: evaluate it against KNOWN CURRENT STATE — if it fires now
  with nothing new, it is wrong.** One lookup, catches the whole class (it caught this and #12110).
- **Holding triggers (v3 — ALL THREE required, else no trigger):** (1) non-bot `author_association` ·
  (2) addressed to **us / the decision**, not to the PR author, and **not our own bot's prior output**
  · (3) changes a **load-bearing input** (LOC total, ABI gate, CI verdict, standing review state).
  **Or:** #12282 merges · FetchContent rework lands · diff <2,000 · merge/close.
  ⚠️skallweitNV's bandwidth gate is a **tripwire, not a condition #12282 can satisfy** — it does not
  clear on that merge. ⭐*"is it addressed to us?" and "is it FROM us?" fail differently — test both.*
- **✅ 08-04 ENDPOINT SET VERIFIED COMPLETE via a THIRD instrument (Main).** The approver reached "no
  same-repo linked issue" by REST body/cross-ref scan after GraphQL 401'd. Confirmed with a genuinely
  different instrument — **`issues/803/timeline`** (`connected` / `cross-referenced` events):
  **exactly 1 relevant event, `cross-referenced src=12282 repo=shader-slang/slang`; ZERO `connected`;
  zero same-repo links.** ⇒ `issues/803` and `pulls/803` index the same conversation ⇒ **the
  3-endpoint scan keyed on `803` is COMPLETE.** Re-check if a same-repo `Fixes #N` is ever added.
  ⭐**`issues/N/timeline` is the REST substitute for GraphQL `closingIssuesReferences`.**
- ⛔⛔**SELF-RETRACTED 10:12Z — I CALLED A TRANSIENT OUTAGE A STANDING CAPABILITY.** `gh api graphql` returned `Bad credentials` on my edge ~09:4xZ and **`{viewer:{login:nv-slang-bot[bot]}}` at 10:12Z** — recovered with no action by me; the triager reports `updateIssue` working in its session too. ⇒ ⭐⭐⭐**a capability probe is a MEASUREMENT WITH A TIMESTAMP, not a property of the edge** — I turned one failed call into "unavailable fleet-wide" and shipped that phrasing to a peer as the CORRECT way to say it. ⭐⭐**The tell was in my own store: [[project_github_actions_graphql_401_outage]] records this exact endpoint recovering before** ⇒ a known-intermittent failure is the last thing to call standing. ⭐**Right form: "GraphQL 401'd at <time>; re-probe before relying on it."** ✅SURVIVES: path-CLASSING is real (REST / GraphQL / introspection fail independently) and `issues/N/timeline` is still a good REST substitute. ⛔DOES NOT: any claim GraphQL is permanently down. ⚠️Original scoped note follows —
  `gh api graphql` → `Bad credentials` **on Main's edge too**. Per [[slang-tick87-instrument-lessons]]
  §1 the 401 is **PATH-CLASSED and fleet-wide** (REST works · GraphQL 401s · `auth status` /
  `rate_limit` 401s). ⇒ ⭐**Never attribute a fleet-wide capability gap to your own edge** — it invites
  the next tier to "try it over there" and burns a round-trip. Say *"GraphQL is unavailable
  fleet-wide; used REST path X."*
- **Carried forward in the row:** R2's fallback findings remain an **UNVERIFIED must-verify list** if the cap ever clears — and **per-symbol gating must be re-checked then**: `cpu-device.cpp:36` is inside the feature `#ifdef` (mooted while OFF) but **`cpu-command.cpp:336` is UNCONDITIONAL.**

Fork PR `WeakKnight:cpu-ray-tracing`. Approver verdict **ABSTAIN_POLICY
(CLAUSE_FAIL:tier_eligible)** — deterministic size cap, 5/6 clauses PASS.
Approver posts nothing (shadow mode, [[feedback_approver_never_posts_route_reviewer]]).

## Revisions
- **R1 `2fc21a3`** (decided): 12,724 LOC — included a **copied** 9,376-line
  `external/tinybvh/tiny_bvh.h`. CI `action_required` (fork) ⇒ never ran.
- **R2 head `86f79f6`** (3 commits, last push 2026-07-31T14:25Z): tinybvh copy
  **replaced by a git submodule** pinned to upstream `4431a64a`; CTS oracle
  relaxed. Total now **3,391 LOC / 14 files**.

## ⭐ The size cap must be re-tested against the NEW TOTAL, not the delta
Dropping the 9,376-line vendored blob *looks* like it should cross back under
the 2,000 cap. It does not: **3,391 > 2,000 ⇒ `tier_eligible` still FAILS**, so
the verdict is invariant across R1→R2. That makes a full harvest+Devin re-run
provably non-informative — evidenced hold, not a silent no-op
([[feedback_debounce_approver_dispatch_deterministic_abstain]]).

## ⚠️ "CI never ran" went STALE at R2 — a reinforcing reason can retire without moving the verdict
At R2 CI **is** running (`pre-commit` success, ~8 builds success, rest
in_progress/queued; combined `success` for cla+CodeRabbit). The approver's
reinforcing reason #1 was true at R1 and is **false at R2** — a fork PR's
`action_required` checks start once a maintainer approves the run. Do not
re-relay it. The verdict stands on the size cap alone.

## MINE-VERIFIED: green builds are ZERO coverage of the new code
`prelude/slang-cpp-ray-query.h` → **404 at tag `v2026.12.2`** (the pin at
`CMakeLists.txt:150`) and 404 at `master`; control `prelude/slang-cpp-prelude.h`
→ 200 at the same tag, and tag `v2026.12.2` resolves 200 while bare `2026.12.2`
404s (tag-prefix trap avoided — [[project_slangpy_1089_shader_cache_path_vulkan_segv]]).
Companion **slang#12282 is OPEN** and adds exactly that file.
⇒ `SLANG_RHI_CPU_RAY_QUERY_ABI_AVAILABLE=OFF` (CMakeLists.txt:486-499) ⇒
`SLANG_RHI_ENABLE_CPU_RAY_QUERY` defaults **OFF** ⇒ the 1,120-line CPU
traversal, `tests/test-cpu-ray-query.cpp`, and the CPU CTS cases are **not
compiled**. Textbook [[feedback_green_job_skipped_backend_zero_coverage]] —
green job, feature compiled out.

## Human engagement (found by the inbound scan, invisible to a diff-only check)
**jkwak-work** reviewed 2026-07-30 (17 inline comments total: CodeRabbit 11,
WeakKnight 4, jkwak-work 2) — all `COMMENTED`, **no CHANGES_REQUESTED**:
1. `external/tinybvh/tiny_bvh.h:1` — "should be a submodule rather than a copy"
   → **RESOLVED** by `86f79f6`; author noted the copy differed from upstream only
   in trailing whitespace/final newline.
2. `CMakeLists.txt:488` — "cannot figure where `slang-cpp-ray-query.h` is found
   from. Do you have another PR in slang repo?" → answer is slang#12282; **no
   direct reply thread from the author to this comment** (he did answer the
   adjacent CodeRabbit thread citing #12282). Author's to answer, not ours.

`mergeable_state: behind` (not blocked).

## RESUME triggers — ⚠️v3, after BOTH earlier versions proved unfireable
⛔**v1 could NEVER fire** ("non-bot actionable *review*" — a review-state predicate
can't match a stateless directive). ⛔**v2 is ALWAYS SATISFIED** ("actionable non-bot
feedback in ANY of the 3 endpoints" — skallweitNV's 16:50Z comment meets it right
now, so it would wake an R4 with nothing new to decide). ⭐⭐**Fixing an
under-firing predicate produced an over-firing one; the correction direction FELT
safe both times.** After any predicate fix, **test it against KNOWN-CURRENT state: if
it fires now with nothing new, it's wrong** (the same test that caught #12110's).

✅**v3 — the missing discriminator is the ADDRESSEE, not the endpoint or the state.
All three parts, in order:**
1. **Non-bot author** — check `user.type != "Bot"` / `author_association`, **never**
   an `endswith("[bot]")` test on a `gh pr view --json reviews` login (suffix is
   stripped there ⇒ false negative).
2. **Addressed to the DECISION, not to the contributor.** MINE-VERIFIED: the 16:50Z
   comment opens literally `@WeakKnight` (assoc `MEMBER`) — a change request **to the
   author**, actionable *for the PR*, not an inbound for the *approval decision*. A
   decision-relevant inbound is a maintainer verdict, a reviewer asking **us**
   something, or a human overriding the abstain.
3. **Changes a load-bearing input** — LOC total, the ABI gate (`slang-cpp-ray-query.h`),
   CI, or a standing verdict.

**Terminal-event triggers need their GATE named** (both were wrong *when written*, not
merely stale): MINE-VERIFIED **slang#12282 = 9 reviews, ALL `COMMENTED`, 0 APPROVED**;
**#803 = 7 reviews, ALL `COMMENTED`, 0 APPROVED**. Neither is awaiting a merge button —
both await a **first approving review**. So:
- **slang#12282: a reviewer APPROVES → it merges** ⇒ ABI header ships ⇒ pin bump makes
  the feature compilable. This is the big one. ❌not "when #12282 merges".
- **#803: a reviewer APPROVES → merge/close.** ❌not "merge/close".
- **skallweitNV's FetchContent rework lands** (submodule → `FetchContent`).
- Diff drops **below 2,000 LOC** (would flip `tier_eligible`) — unlikely.
⚠️skallweitNV's separate **bandwidth/design gate** is NOT cleared by #12282 merging.

⏱️**CI at head is SETTLED and fully green — re-probed 2026-08-04 05:4xZ / re-verified
by me: 21 check-runs, all `completed`, 20 success + 1 skipped, zero in_progress.**
❌The row previously said "CI still mid-flight" in the present tense from a 17:20Z
reading — **~18h stale.** Doesn't move the verdict (the size cap stands alone), but
⭐**a present-tense claim in a durable row silently ages into a false one: timestamp
every observation or re-probe it.**

Do **not** re-dispatch the approver on further synchronizes while the total
stays >2,000 and no **actionable non-bot feedback in ANY of the 3 endpoints**
lands (`pulls/{n}/reviews` · `pulls/{n}/comments` · `issues/{n}/comments`).
❌Never write this condition as "no non-bot **review**" — a review-state
predicate can't fire on a directive that arrives with no review state, which is
exactly how #803's FetchContent change request went unseen.
