---
name: project_slang_rhi_811_shader_object_layout_cache_uaf
description: "slang-rhi#811 — stop caching ShaderObjectLayout keyed on a caller-supplied TypeLayoutReflection* (fixes slang#10893 UAF); dispatched to slang-pr-approver on head e062d03f after two webhooks collapsed into ONE dispatch by resolving head.sha first"
metadata:
  node_type: memory
  type: project
  title: slang-rhi#811 shader-object-layout cache UAF
  tags:
    - slang-rhi
    - approver
    - live-chain
    - use-after-free
  originSessionId: pending
---

# slang-rhi#811 — do not cache shader object layouts keyed on a caller-supplied type layout

**Author:** `jvepsalainen-nv` (assignee of the underlying issue). **Opened** 2026-08-05 12:39Z.
**Fixes** [slang#10893](https://github.com/shader-slang/slang/issues/10893) — *"Use-after-free of
TypeLayoutReflection in slang-rhi ShaderObjectLayout cache"*, labels `Dev Reviewed` + `CI Bug`,
open since 2026-04-21, assigned to the same author. So this is the author closing their own
triaged CI-bug — **not** a drive-by.

## The change (5 files, +111/-1)

`Device::m_shaderObjectLayoutCache` is keyed on a raw `slang::TypeLayoutReflection*` and lives as
long as the `Device`. Two entry points reach it; only one holds a reference to the key's owner:

| entry point | key origin | owner | ref held | safe |
| --- | --- | --- | --- | --- |
| `createShaderObject(session, type, container)` | `session->getTypeLayout(type)` | `Linkage`/`ISession` | `ComPtr<ISession>` | yes |
| `createShaderObjectFromTypeLayout(typeLayout)` | **caller-supplied** | `TargetProgram`/`ComponentType` | the *device's* session — wrong object | **no** |

Fix: that second path calls `createShaderObjectLayout` directly, bypassing the cache. Plus a
`testing::getShaderObjectLayoutCacheSize` hook and a GPU regression test that creates twice from a
reflected layout and asserts cache size is unchanged.

⭐**The test asserts the INVARIANT, not the crash** — the PR body says testing the UAF directly
would be testing for *"ASan happened to stay quiet,"* which is how these findings were previously
written off as fixed. Worth remembering as a pattern: a nondeterministic-visibility bug gets a
deterministic test by pinning the property that causes it.

Two alternatives named and rejected in the body: keying on `ShaderComponentID` (name-based ⇒
collisions return the *wrong* layout, worse than crashing) and validate/evict on lookup (no way to
test a raw pointer for staleness; Slang exposes no destruction hook).

## Dispatch record

⚠️**TWO webhooks arrived ~4 min apart** (`opened` @ `5d00ad513e1b`, then `synchronize`
@ `e062d03f24e7`). I had not dispatched yet when the second landed, so **one** dispatch went out,
against the current head — no churn, nothing to debounce.

✅**The head-resolve check earned its keep again.** Payload equality would have read as a duplicate;
`compare/5d00ad51...e062d03f` → **ahead_by 1**, one file `+1/-1`. Real push: the em-dash → ASCII
hyphen fix CodeRabbit asked for. Cf. [[feedback_debounce_approver_dispatch_deterministic_abstain]]
— ⭐⭐**the dispatcher must resolve `head.sha` BEFORE dispatch, and two webhooks landing before the
first dispatch collapse into one, which is the cheapest possible outcome.** Getting there required
no debounce reasoning at all — just not dispatching on the first payload reflexively.

## State at dispatch (head `e062d03f24e7beecea54559efdc70cb5b8d2b592`)

- `pre-commit` **failed on `5d00ad51`** — `check-ascii-source` rewrote line 22 of the test (em dash).
  ⭐**The failure log carried the whole diff the hook applied**, so the cause was readable without a
  local repro. **Now `success` on `e062d03f`.**
- **18 build checks `pending`** at dispatch; `mergeable_state=blocked`. Whether that makes a
  CI clause unevaluable is the approver's call, not mine.
- **Reviews:** only `coderabbitai[bot]` `COMMENTED`, and it sits on the **superseded** `5d00ad51`.
  **Zero human reviews.** Two CR inline comments, both 🟡 Minor: the em dash (now fixed) and
  *"`REQUIRE_CALL` validates the result code only — require `secondShaderObject != nullptr`"*
  (still open at dispatch).
- CR suggests reviewers `bmillsnv`, `skallweitnv`. CLA `success`, commit authored by
  `jvepsalainen-nv` id `161336110` — **not** the two-bot-identity case
  ([[feedback_two_nv_slang_bot_identities_cla_gate]]).

## 3rd webhook (`synchronize`) — head moved AGAIN to `4c020aeb5dde` @12:57:39Z, and the delta is load-bearing

⛔**The sha I dispatched (`e062d03f`) was BROKEN, and its CI proved it after I dispatched.** Head-resolve
again: `compare/e062d03f...4c020aeb` → `ahead_by 1`, `tests/test-shader-object-from-type-layout.cpp
+14/-2`. Author `jvepsalainen-nv` id `161336110`, commit *"Unwrap the debug-layer device in the layout
cache test"* (`Co-Authored-By: Claude Opus 5`).

Mechanism, **mine-verified from source, not taken from the commit message**: with validation on, the
test is handed a `debug::DebugDevice`, not the `Device` that owns `m_shaderObjectLayoutCache`. The
`checked_cast<Device*>` inside `testing::getShaderObjectLayoutCacheSize` then fails. `src/core/common.h:45-58`
confirms the config split verbatim — under `SLANG_RHI_DEBUG` it does a `dynamic_cast` and
`SLANG_RHI_ASSERT_FAILURE("Invalid type cast")`; **`#else return static_cast<T>(u)`**. Fix adds a
`getInnerDevice` unwrap using `dynamic_cast<debug::DebugDevice*>` → `baseObject.get()`; the cited
precedent is real — `tests/test-cmd-upload-buffer.cpp:15-21` has the identical idiom.

### 🔴 RETRACTED — "the 5 Release passes are FALSE COVERAGE" was WRONG. They were real coverage all along.

**My premise failed.** I argued Release greens were vacuous because `checked_cast` degrades to
`static_cast`, so the cast would silently succeed on a wrapped device and `CHECK_EQ` would compare two
reads off a bogus pointer. That hangs entirely on **the device being wrapped in Release** — and it is not.
The approver probed it at my request and refuted me; I then verified independently rather than accepting
the refutation. `tests/testing.cpp:790-795`:

```cpp
#if SLANG_RHI_DEBUG
    deviceDesc.enableValidation = true;
#endif
```

`enableValidation` is set **only under `SLANG_RHI_DEBUG`** (`testing.h:338` defaults it `false`;
`testing.cpp:613` copies only caller-supplied `extraOptions`, and `GPU_TEST_CASE` passes
`extraOptions = nullptr`). ⇒ in Release **nothing wraps the device**, `checked_cast<Device*>` is
legitimately correct, and the 5 Release passes were **genuine coverage**. ⛔**Do not repeat the
false-coverage framing; it was retracted 08-05 and a correction went upstream.**

⭐⭐⭐**What actually went wrong: I reasoned from a config-conditional mechanism WITHOUT READING THE
CONFIG.** I had the whole `checked_cast` body open (`common.h:45-58`) and correctly saw Debug≠Release —
then asserted the *device* was wrapped in both, which is a different file I never opened. **The
`#if` I needed was 4 lines above a line I did cite.** Textbook unopened-state claim: cf.
[[feedback_control_the_instrument_not_the_reasoning]]. ⭐⭐**Naming my own premise as unverified is
what made it checkable** — I flagged "I did not verify the device is wrapped in Release" and named the
circularity hazard (refusing to inherit the approver's `testing.cpp:794` read as my support). That
refusal paid off: **their line-794 read was ALSO wrong in the same direction** (they called it
"unconditional," having read the cited line but not the `#if` above it). Had either of us inherited the
other's premise, two derivations would have propped up one false fact and read as "confirmed twice."

⭐⭐**A retraction that arrives with the check that would settle it is cheap; one that arrives as a
conclusion is not.** I asked for the probe that could kill my claim and said in advance what I'd do if
it did — so the correction cost one exchange, not a defended position.

### ⭐⭐ The Debug picture (this part SURVIVED the retraction)

The R0 🔴 is unaffected: the wrapper **is** present in Debug, which is exactly where the 4 legs
SIGABRTed. The abort was real and correctly diagnosed; only my Release claim was wrong.

### ⛔ My enumeration PREDICATE was also defective — `unitTestStep=0` is not the discriminator

**The COUNTS were right; the PREDICATE I derived them from was wrong.** I reported that 8 of the 18
`success` jobs "have no Unit Tests step at all — build-only," inferred from `awk`-ing step *names* out of
the job **log**. The approver corrected it and I verified via `actions/jobs/<id>` `.steps[]`: **all 9
non-executing legs DO have the step — `Unit Tests=skipped, Unit Tests (OptiX 8.0)=skipped,
Unit Tests (OptiX 8.1)=skipped`.** The discriminator is **`conclusion == "skipped"` at the STEP level**,
not step absence.

⭐⭐⭐**A skipped step emits no log lines, so a log-derived census cannot tell "step absent" from "step
skipped" — the instrument was blind to the exact distinction I used it to draw.** Same counts today,
and that is the trap: **an accidentally-correct tally validates nothing about the method.** A leg that
gains the step without running it would silently land in my "executed" bucket. ⇒ **read step
conclusions from the API (`.steps[] | select(.name|test("Unit Test")) | .conclusion`), never infer step
existence from log output.**

Corrected table for `e062d03f`:

| | jobs | test outcome |
| --- | --- | --- |
| Debug, executed the test | **4** | **4 FAILED** (`SIGABRT`, `Assertion failed: Invalid type cast`) |
| Debug, `success` | 5 | Unit Tests step present but **`skipped`** (no runner/device) |
| Release, executed the test | 5 | all PASSED — **real coverage** (device unwrapped in Release) |
| Release/other, `success` | 4 | Unit Tests step present but **`skipped`** |

⇒ **No Debug job executed this test and passed** (that stands), and **9 of the 18 `success` legs never
executed a test** — cf. [[feedback_green_job_skipped_backend_zero_coverage]]. But the Release passes
**did** validate `device.cpp`, so `e062d03f` was not evidence-free; it was Debug-broken with real
Release coverage.

⚠️Inbound scan on the 3rd webhook: still **zero human reviews**; only `coderabbitai[bot]` `COMMENTED`,
`commit_id` `5d00ad51` — now **two shas stale**. Its 2 inline 🟡 comments are unresolved; the em-dash one
was addressed by `e062d03f`, the *"require `secondShaderObject != nullptr`"* one is still open and
untouched by `4c020aeb`.

## ✅ TERMINAL (approver): ABSTAIN_INFRA `NO_REVIEW_SIGNAL` @ `4c020aeb` — recorded 08-05 ~13:28Z

`mode=live`, policy `v0-shadow-wide`, **6/6 Step-1 clauses PASS**. The abstain is a **Step-2
harness-integrity short-circuit** — *no review signal covers this head* — **not** a finding against the
code. No ledger row for `e062d03f`, by agreement.

**The approver REVERSED a WOULD_APPROVE it had already told me was settled in substance**, after its
DECISION_REVIEW gate returned must-fix. Both review limbs are absent on the head:

1. ⛔**CodeRabbit was RATE-LIMITED and never ran on `4c020aeb`.** **Mine-verified** in
   `issues/811/comments` id `5191828253`: `<!-- auto-generated comment: rate limited by coderabbit.ai -->`
   … *"you've reached your PR review limit, so we couldn't start this review. Next review available in:
   41 minutes."* ⭐⭐⭐**The trap: the `📥 Commits` header naming `e062d03f...4c020aeb` sits INSIDE that
   rate-limited block — it is the SCOPE OF A REVIEW THAT DID NOT RUN, and it reads exactly like
   head-currency evidence.** The approver had cited it to me as proof of coverage. ⚠️Also note
   `created=12:39:49Z` but `updated=12:57:56Z` — **the comment was EDITED IN PLACE at the 3rd push**, so
   its id/creation time tells you nothing about which sha it addresses. The only actual review on file is
   still `COMMENTED @ commit=5d00ad51` — **two shas stale**.
2. **Devin's body is one revision stale under live header chrome**: its per-group diff stats sum to
   **+111** (the `e062d03f` total; head is +123), `grep -Ei 'getInnerDevice|DebugDevice|debug-layer|unwrap'`
   over the page returns **zero**, and its `1 Bug` *is* the R0 abort this very commit fixes.
   ⇒ `reviewers_complete: false`.

⭐⭐⭐**The lesson the approver volunteered, which is the most valuable thing in this whole chain: its own
executed-CI evidence was real, pointed the right way, and did NOT save the verdict — and must not.**
That evidence is *the approver's verification*, not a review signal; substituting it for a missing review
doc is exactly what the procedure forbids. ⇒ **"The strongest pull toward rounding up is having done real
work that points the right way."** Two hours of correct verification is what makes a missing input feel
skippable. Cf. [[feedback_approver_step1_clauses_are_data_only_judgment_is_step3]].

**On the merits (approver's read, for whoever picks it up — NOT a decision):** fix is sound;
`src/device.cpp` byte-identical to R0; the bypassed wrapper does only cache find/emplace; the unwrap is a
raw `dynamic_cast` ⇒ correctly config-independent; the assertion is a **real negative control** —
`CHECK_EQ` guards exactly the `emplace` at `src/device.cpp:1136`, so reverting the fix fires it; 3 of 4
wrapper-bearing Debug legs passed on 7 backends. **A re-harvest after CodeRabbit's window reopens would
very likely clear this to WOULD_APPROVE.**

⚠️**Artifact trap worth keeping: `devin-flags.md` STRIPS THE COUNT TOKEN** — the extractor consumes
`1 Bug`/`1 Flag` as section delimiters, so the liveness token survives only in raw `devin-page.txt`.
**Grepping the extract alone reads a GENUINE run as tokenless and mislabels it a false clean.**

⚠️**4th Debug leg (`windows x86_64 clang Debug`) still `in_progress` at close** (steps `null`); run
`31007961289` `in_progress`. Immaterial to this verdict — it turns on the absent review signal, not CI.

## 4th webhook (`synchronize`) — head `2a3524d8` @13:41:35Z. BOTH premises of the abstain moved ⇒ re-dispatched R2.

Head-resolve first, 4-for-4: `compare/4c020aeb...2a3524d8` → `ahead_by 1`, **3 files** — `src/device.cpp`
`+19/-26`, `src/device.h` `+27/-9`, the test `+15/-32`. PR total now **+133/-17, 5 files**. Author
`jvepsalainen-nv` id `161336110`. Commit *"Derive the layout cache key internally instead of accepting one."*

**This is a re-architecture of the fix, not a touch-up** — read the patch, don't infer from the subject:
- **The `getShaderObjectLayout(session, typeLayout, outLayout)` overload is DELETED** (`device.h`). The
  remaining `type`-taking overload now derives `session->getTypeLayout(type)` internally and inlines the
  cache find/emplace. ⇒ the cache is now **structurally incapable** of accepting a caller-supplied key,
  where R1 merely had one call site decline to use it. `m_slangSession = session` moved *after* the
  emplace. **An API-surface deletion is broader than the original scope** — a private method, but the
  approver must reason about it, not the R1 diff.
- **The debug-layer unwrap MOVED out of the test into `testing::getShaderObjectLayoutCacheSize`**
  (`src/device.cpp`, `dynamic_cast<debug::DebugDevice*>` → `baseObject.get()`). The test's local
  `getInnerDevice` helper and its `debug-device.h` include are gone. ⭐**The new comment states my own
  retracted-and-corrected mechanism correctly** — *"checked_cast only verifies the downcast under
  SLANG_RHI_DEBUG, so a wrapper reaching it aborts in debug builds but silently reads a bogus pointer in
  release ones"* — i.e. the release hazard is real **only if a wrapper reaches it**, which in Release it
  does not (`testing.cpp:790-795`). Do not let this comment revive the retracted false-coverage claim.
- ✅**The negative control SURVIVED the rewrite** — verified at head, not assumed:
  `CHECK_EQ(getShaderObjectLayoutCacheSize(device), cacheSizeBefore)` at line **59**, still two
  `createShaderObjectFromTypeLayout` calls. Comment prose was rewritten but the assertion is intact.
- ⚠️CR's still-open 🟡 (*"require `secondShaderObject != nullptr`"*) is **still unaddressed** — the head
  has `REQUIRE(shaderObject != nullptr)` at :51 but **no** matching REQUIRE for `secondShaderObject`.

### 🔴 The author declared WIP and REMOVED BOTH REVIEWERS — new fact, postdates the abstain

`issues/811/comments` id **`5192349256`** @13:28:53Z, author `jvepsalainen-nv`: *"Removed review requests
for now. Work in progress."* Timeline confirms `review_request_removed` for **`bmillsNV` and
`skallweitNV`** at 13:28:08Z (both had been added by `coderabbitai[bot]` @12:40Z). `requested_reviewers`
is now **empty**; `draft` is still **false**, and the timeline has **no `ready_for_review` event ever** —
the PR was opened non-draft, so the webhook's `pr_ready_for_review` name is the host's generic
reviewable-PR event, **not** a draft→ready transition. ⭐**The WIP note landed ~45s BEFORE the approver
recorded its abstain, and the push came 13 min AFTER it** — so a push does not revoke it.
⚠️**This cuts against the abstain's own expiry story: the abstain was `NO_REVIEW_SIGNAL`, and the author
has made a HUMAN review signal *less* likely, not more.**

### ✅ CodeRabbit's rate-limit window DID reopen and it re-reviewed clean — but it left NO review row

Mine-verified on comment `5191828253` (`updated_at` **14:08:49Z**): the **`rate limited by coderabbit.ai`
marker is GONE**, the `📥 Commits` header now reads *"between `e062d03f…` and `2a3524d8…`"* (spans the
current head), and the body says **"No actionable comments were generated in the recent review. 🎉"**
⇒ this is a **genuine** run, unlike the R1 case where that same header sat inside a rate-limited block.
⛔**BUT `pulls/811/reviews` STILL returns exactly ONE row — `COMMENTED @ 5d00ad51`, now THREE shas stale.**
0 inline comments after 13:41Z. ⇒ ⭐⭐⭐**A clean CodeRabbit pass materializes as an EDIT to the summary
comment, not as a review row on the head sha — so a harvester keying on `reviews[].commit_id` sees
"no review on head" while a harvester reading the summary comment sees a current clean pass. The two
instruments disagree, and last round the trap ran the other way (a stale-scope header that read as
current). Check the rate-limit marker's ABSENCE, not the header's presence.**

### CI at dispatch (head `2a3524d8`)

`fetched=20 == total_count=20`. **6 success / 14 PENDING.** Successes are `pre-commit`, `board-sync`, and
the 6 linux `aarch64`/`gcc` + `emscripten Debug` legs. ⛔**Every `x86_64 clang`, `msvc`, `macos aarch64`
and Release-x86 leg is still PENDING — i.e. none of the 4 wrapper-bearing Debug legs that carried the R0
abort have reported yet.** `mergeable_state=blocked`. Per the standing rule, read per-job `.steps[]`
conclusions (never a log-derived census, never the rollup while `ci` is queued).

## ✅ TERMINAL (R2, approver): ABSTAIN_POLICY `CHALLENGER_CONCERN` @ `2a3524d8` — recorded 08-05 ~14:29Z

**Every harness input said approve, and it abstained anyway** — 6/6 Step-1 clauses PASS, **CI fully
green**, CodeRabbit genuinely reviewed *this* head, 0 🔴, both nits cleared. The abstain rests entirely
on the WIP declaration, which is the question I routed to them without answering.

**Their reasoning, which I think is right:** `WOULD_APPROVE` claims the change is *ready to merge*; the
artifacts establish only that it is *sound*. Different predicates — **only the author can speak to
readiness, and they said "Work in progress" and pulled both reviewers.** ✅They correctly did **not**
reuse `NO_REVIEW_SIGNAL`: *a repeated reason_code claims the same defect persists*, and both R1 premises
had resolved. **Flips to WOULD_APPROVE on a human readiness signal** — the author saying so, **the author
(not a bot)** re-requesting reviewers, or a maintainer engaging on the head.

⚠️**Policy gap they flagged rather than improvised around: no `author_declared_ready`/`not_wip` predicate
exists**, so the one thing that stopped this approval is **invisible to the script**.
⭐**Flagging a missing predicate beats inventing a clause mid-decision.**

### 🔴 RESOLVED — and I had ROUTED IT UPSTREAM AS AN OPEN OPERATOR ITEM TWICE BEFORE IT WAS

⛔**The proposed clause is DEAD ON BOTH LIMBS** — refutation published as
`1785942491533-approver-clause-gap-an-ask-is-a-claim-about-a-mech.md`. ⚠️**MY FIRST WORDING HERE SAID
"the approver proved it themselves" AND THAT IS AN UNEARNED CREDIT I INVENTED — the learning's own text
refutes it:** *"I never turned it on my own proposal"* (line 39), *"Neither of us asked the cheaper question
first"* (14), *"the correct result, reached one command too late"* (66). **The probe was NOT run before the
ask shipped**; the refutation came after. (Their account — attributed, not verifiable from here — is that
the killing analysis was written by a **sibling session**, and that `originSessionId` is a file-creation
stamp, not per-line authorship. Consistent with my own standing rule that this store has no line-level
provenance.) ⇒ **What is true of the proposing session: it correctly flagged the gap rather than improvising
an unreviewable clause, AND it failed to run the 4-step dead-flag probe it already holds. A credit that
collapses those into only the first is false.**
- *"PR is non-draft"* — **zero bits.** The approver pipeline is driven by the `ready_for_review`/
  `synchronize` webhook, so `draft==false` is an **entry precondition**: the clause passes on every PR the
  tier will ever see. One command settles it: `gh pr view 811 --json isDraft` → `false`, **on the very PR
  whose author declared WIP.**
- *"no author comment declaring WIP"* — **not a data predicate.** Reading "Work in progress" out of free
  text is a judgment call; as a Step-1 clause it evaluates `unevaluable` and manufactures spurious
  ABSTAIN_INFRA fleet-wide, destroying the measurement signal the wide shadow policy was widened to buy.
- ⇒ **#811 is its own refuting control: the clause would have PASSED and changed nothing about the decision
  it was invented to protect.** Correct home is a **standing judgment probe**; if scripted support is ever
  wanted the only data-shaped signal is a **structured** one (a `wip`/`do-not-merge` label), never prose.
- ✅**Net: NOTHING for the operator to sign off.**

⛔⭐⭐⭐**MY OWN DEFECT, and it is the same one this chain kept producing: I relayed "policy gap, open for
you to route" to the operator in TWO consecutive reports without running the probe on it.** A gap *stated
by the tier that owns the mechanism* felt pre-verified — the diligence slot again, this time wearing
**"faithfully forwarding someone else's flagged limitation."** ⇒ **A FORWARDED ASK IS STILL AN ASK, and it
gets the dead-gate probe before it reaches a human:** name the input that makes it FAIL · find a
trigger-present control (⛔**if your motivating case PASSES the proposed clause, the clause is not the fix
for that case** — #811 did) · check entry preconditions (*how did this PR reach me?*) · check evaluability
against the tier's data. ⭐⭐**Cheapest possible check here was `--json isDraft`, one call, and it was
available to me from the first report.** Cf. [[feedback_a_multi_probe_turn_has_a_window_not_a_timestamp]]
(self-accusation/forwarding both occupy the scrutiny slot) and
[[feedback_a_guard_can_be_inert_and_read_as_passing]] (the dead-gate family).

### ✅ CI COMPLETED GREEN — verified by me, and R1's picture did not transfer (it got better)

Run **`31013368950`** `status=completed conclusion=success` on `2a3524d8`. **All 21 check-runs `success`**
(⚠️`total_count` grew **20 → 21** after my dispatch — see below). Approver's per-job read, which I accept
on the strength of its method (`fetched=19==total_count=19`, discriminating on `.steps[].conclusion`):
**all 4 wrapper-bearing Debug legs executed the test and PASSED**, and `windows x86_64 clang Debug` —
which never completed on R1 — is now the **broadest single leg** (`.cpu .cuda .d3d11 .d3d12 .vulkan
.wgpu`). 7 backends, zero aborts. Census parts-sum checks: Debug 9 = 4+5, Release 10 = 5+4+1 → 19.

### Two open items they closed (both verified, both worth having)

- **The deleted `typeLayout` overload is safe** — sole remaining caller is the `type`-taking form at
  `src/device.cpp:791`; no orphans.
- **`m_slangSession` moving after `detach()` is NOT a behaviour change** — `ShaderObjectLayout::initBase`
  (`src/shader-object.cpp:24`) already assigns it on *every* construction path incl. the non-cached one,
  so no layout reaches a consumer with a null session. ⭐**Worth checking precisely because "an assignment
  moved" is the shape that hides a null-deref.**
- CR's `secondShaderObject` 🟡 cleared as **trigger-unreachable** (`returnComPtr` unconditional on success).

### 🔴 My "requested_reviewers is empty" was STALE — and I declined their charity about it

`bmillsNV` was re-requested at **14:07:36Z**; `reviewRequests` holds 1. ⛔**But the actor is
`coderabbitai` `__typename: Bot`** — the same bot that auto-requested both at 12:40:00Z. **Mine-verified
via GraphQL** `timelineItems(REVIEW_REQUESTED_EVENT).actor.__typename`. So it is **not** the author
revoking WIP; the approver initially read it that way, caught it themselves, and named the rule:
⭐⭐⭐**an event that changes state is not evidence about INTENT until you check its `actor`** — the
`__typename`-not-`[bot]`-suffix rule ([[feedback_two_nv_slang_bot_identities_cla_gate]]) extended from
**authorship to ACTORSHIP.** Their error pointed toward approval and sat inside a correction to my fact.

⛔**They excused mine as *"true when you stamped it."* IT WASN'T, and I checked rather than accepting it:**
later in the same turn I read CR's comment at `updated_at` **14:08:49Z**, which proves my own clock had
passed the 14:07:36Z change point by 73s. ⇒ [[feedback_a_multi_probe_turn_has_a_window_not_a_timestamp]]
— **a multi-probe turn has a measurement WINDOW, not a timestamp; the proof my fact had expired was in my
own output two calls later.** And the symmetric half of the R1 lesson: **don't inherit a peer's unverified
read when it hurts you, and don't inherit their unverified ABSOLUTION when it helps you.**

### ⭐⭐ The artifact lesson of this whole chain: the same PR had two endpoints lie in OPPOSITE directions

- **R1:** the `📥 Commits` scope header said *reviewed* when CodeRabbit was **rate-limited** (header sat
  inside the rate-limit block).
- **R2:** `pulls/811/reviews` says *not reviewed* when it **had** been — a clean pass lands as an **edit to
  the summary comment**, never a review row. (Still 1 row @`5d00ad51`, now **four shas stale**.)

⇒ **Keying on the rate-limit marker's presence/absence is the only probe that got BOTH right.** Marker
count 2→0 across the window.

## 5th webhook (`synchronize`) 08-10 07:04:57Z — head `b4ca3c8c`. ✅EVIDENCED HOLD, NO re-dispatch.

Head-resolve first, **5 for 5** (head has moved on every single webhook this chain). `compare/2a3524d8...
b4ca3c8c` → **ahead_by 6**, 13 files — but the composition is what decides it:

| commits | what |
| --- | --- |
| `3ef27be1` @08-06 18:14Z, author `jvepsalainen-nv` | **the ONLY PR-owned commit**: `+1/-0` on the test — `REQUIRE(secondShaderObject != nullptr)`. **This closes CodeRabbit's last open 🟡 verbatim.** |
| `5f00bdc5` `8ffe21c5` `2b32772b` `5175fbbf` | upstream main (#813 #814 #815 #819) — CUDA/Vulkan/D3D12/Metal native-handle work by `fknfilewalker`, `tdavidovicNV`, `skallweitNV`. Not this PR's. |
| `b4ca3c8c` @07:04:55Z | `skallweitNV` (id `64953474`) *"Merge branch 'main'"*, committer `web-flow` ⇒ **browser "Update branch" click.** |

⛔**The core fix is BYTE-IDENTICAL: `src/device.cpp` / `src/device.h` are not in the delta at all**
(`map(select(test("src/device"))) | length` → **0**). Every non-test file in the delta is upstream code.

### The three tripwire conditions — all THREE still negative, checked individually

1. **Author declares ready — NO.** ⭐**The WIP comment `5192349256` is still standing VERBATIM and was
   never edited: `created_at == updated_at == 13:28:53Z`.** (Cf. this chain's own trap where CR's summary
   comment *was* edited in place — so equality here is a real check, not a formality.)
2. **AUTHOR re-requests reviewers — NO.** GraphQL `timelineItems.actor.__typename`: the last
   `ReviewRequestedEvent` is still `coderabbitai`/**`Bot`** @14:07:36Z 08-05. **Zero User-actored
   review-requests since the author's own 13:28:08Z removals.** `pending: [bmillsNV]` is that bot artifact.
3. **Human maintainer engages on the head — NO, and this is the one that needed discriminating.**
   `skallweitNV` merging main into someone else's PR *looks* like maintainer engagement. ⛔**It is a BATCH
   SWEEP: they ran the identical `Merge branch 'main'` on their OWN PR #598 at 07:02:37Z — 2 min 18 s
   earlier.** ⇒ ⭐⭐⭐**a maintainer action is only engagement-with-THIS-PR if it isn't also happening to
   their other PRs in the same minute — check the neighbours before reading intent.** Same family as the
   actor-`__typename` rule: **an action that changed state is not evidence of intent until you check its
   context.** (Contrast rhi#802, where a skallweitNV branch-update WAS a genuine engagement signal — the
   discriminator is the sweep, not the operation.) No review, no comment, no approval.

⇒ **The verdict's premises are untouched, so a re-run would return ABSTAIN_POLICY with the SAME reason code
— accurate and zero-value, which is exactly the churn the debounce rule forbids.** Inbound scan (the
load-bearing half) run in full: **0 comments of any kind since 08-05 13:41Z**, reviews still the single
`coderabbitai COMMENTED @5d00ad51` — now **five shas stale**.

⏱️CI at hold: run `31364419295` (`ci`) **`status=queued`, `conclusion=null`** — 23 check-runs, 11 success /
2 skipped / **10 pending**. ⛔Read the RUN, not the count (`total_count` grew 20→21 mid-chain last time).

## RESUME

🔵**CHAIN STATE: approver TERMINAL on `2a3524d8` (ABSTAIN_POLICY). 5th webhook HELD 08-10 without
re-dispatch — premises intact, core fix byte-identical, all 3 readiness tripwires negative. Nothing posted
to GitHub by anyone.**

⚠️**PIN `b4ca3c8c6c1bf357755ddd04f72c4d48921a1169` as the current head** — but the last **decided** head is
`2a3524d8`, and the fix is unchanged between them.
🔴**AUTHOR-SILENCE ESCALATION NOW DUE: the WIP note is 4d 17h old** (13:28:53Z 08-05 → 07:04:57Z 08-10,
computed not carried) **and the author's last activity is `3ef27be1` @08-06 18:14Z ⇒ ~3d 13h of author
silence.** My own RESUME set *">~2 days ⇒ worth an upstream note"*; that fired. **A finished-looking PR —
green fix, last nit closed, zero red findings — parked under a 5-day-old self-declared WIP label is the
cheap thing to lose track of.** Reported upstream 08-10; **not** a nudge to the author from us.

- ⛔**PIN `2a3524d8ad685a359e522a511e5efe9172f28022`. Reject any verdict keyed to `5d00ad51`, `e062d03f`,
  or `4c020aeb`.** Head moved on **every** webhook, 4 for 4 ⇒ **on webhook #5, resolve `head.sha` FIRST;
  it is the single most reliable prediction this chain supports.**
- 🔵**RE-DISPATCH TRIPWIRE — a genuine readiness signal, and ONLY these three count** (the approver's own
  flip conditions): (1) the **author** comments that it's ready / removes the WIP framing, (2) **the author
  (NOT a bot)** re-requests reviewers — ⛔check `actor.__typename` via GraphQL, since `coderabbitai[Bot]`
  has already auto-re-requested `bmillsNV` **twice** (12:40:00Z, 14:07:36Z) and it reads exactly like
  author intent, or (3) a **human maintainer** engages on the head (`bmillsNV`/`skallweitNV`).
  **The code side is already there — a re-dispatch on any of these should clear to WOULD_APPROVE.**
- ⛔**A bare `synchronize` is NOT a readiness signal.** The author pushed a full re-architecture 13 min
  *after* declaring WIP, so **pushes and WIP coexist here**; a new push alone means re-pin, not re-dispatch.
- ⏱️**Author has been WIP-silent since 13:28:53Z.** If this sits >~2 days with green CI and no author
  movement, that is worth an upstream note — a finished-looking PR parked under a stale WIP label is a
  cheap thing to lose track of. Not a nudge to the author from us.
- ⚠️**Do NOT re-run to `NO_REVIEW_SIGNAL`** if re-dispatched — CodeRabbit reviewed this head cleanly and
  a repeated reason_code would assert a defect that has since resolved.
- ✅**RESOLVED tripwires, kept only as method notes:** the CR rate-limit expiry fired (marker 2→0, re-review
  clean on head — but as an **edit to comment `5191828253`**, never a review row, so don't read
  "CR reviewed head" off `pulls/811/reviews`); CI completed green on run `31013368950` with all 4
  wrapper-bearing Debug legs executing and passing across 7 backends.
- ⛔**`fetched == total_count` is a TRUNCATION guard, NOT a completeness one** — it read `20==20` at my
  dispatch and `total_count` later grew to **21** (a `finish` check-run created 14:18:01Z). **For "is CI
  done", read `actions/runs/<id>` `status`/`conclusion`, never the check-run count.**
  ⇒ [[feedback_a_multi_probe_turn_has_a_window_not_a_timestamp]]
- ✅**R1 verified BY ME on run `31007961289`** (`fetched=18==total_count=18`, `.steps[]` conclusions):
  **3 of 4 wrapper-bearing Debug legs executed and PASSED**, 4th (`windows x86_64 clang Debug`)
  `pending`/no steps yet. Fleet census, **identical structure on both shas: 9 Debug + 9 Release; skipped
  = 5 Debug + 4 Release = 9.** R0 Debug was `4 EXECUTED_FAIL + 5 SKIPPED`; R1 Debug `3 pass + 5 skipped
  + 1 pending`. ⛔**The peer's "8 Debug skipped, scope difference" is ARITHMETICALLY IMPOSSIBLE — only 9
  Debug legs exist and 3–4 executed. Their 8 is fleet-wide `UnitTests=success` on R1 (3 Debug + 5
  Release), i.e. the EXECUTED count, not a Debug-scoped skipped count.** Corrected upstream; see
  [[feedback_a_config_conditional_mechanism_needs_the_config_read]] §scope-reconciliation.
- **R1 = run `31007961289` on `4c020aeb`.** ⚠️**The rollup LIES on a fresh push: while `ci` is
  `queued`, `statusCheckRollup` shows 16 `SUCCESS` entries INHERITED FROM THE OLDER SHA** (approver's
  find). ⇒ read per-job, and pre-flight `fetched == total_count`.
- **2 of the 4 evidence-bearing Debug legs have executed and PASSED** on `4c020aeb` (`macos aarch64
  clang`: `.cpu`/`.metal`/`.wgpu`; `windows x86_64 msvc`: `.cpu`/`.d3d11`/`.d3d12`) ⇒ the R0 abort is
  fixed with the wrapper present. Outstanding: `linux x86_64 clang Debug`, `windows x86_64 clang Debug`.
- ⛔**A Release green IS evidence here** (device unwrapped ⇒ `checked_cast` legitimate). My earlier
  "Release is not evidence" instruction was part of the retracted framing — do not act on it.
- A **human** review lands (`bmillsnv`/`skallweitnv`) ⇒ inbound to act on, per the endpoint-split
  rule check **both** `pulls/811/reviews` and `issues/811/comments`
  ([[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]]).
- Builds finish ⇒ if any fail, that is new information for the approver, not a re-dispatch reflex.
- Another `synchronize` ⇒ resolve `head.sha` first; if it moved, it is **not** a duplicate.

## ✅⛔⭐⭐⭐ 2026-08-10 07:32Z — MERGED. BOTH APPROVER ABSTAINS REFUTED, EVERY CLAIM VERIFIED, AND A REAL POLICY QUESTION LANDS ON ME.

`slang-pr-approver` reported this as its cleanest recorded loss and escalated rather than self-corrected. **I verified every load-bearing leg before treating the escalation as sound:**
```
merged_at 2026-08-10T07:25:17Z   merge_commit 8b27c96c9a   head b4ca3c8c6c
reviews:  skallweitNV (User) APPROVED @b4ca3c8c 07:08:56Z   <- independent; author is jvepsalainen-nv
compare 2a3524d8(decided) -> b4ca3c8c(merged): status=ahead, ahead_by=6, behind_by=0
  changed files DO NOT INCLUDE src/device.cpp OR src/device.h        <- byte-identity CONFIRMED by absence
  only PR-owned change:  tests/...cpp  +1/-0
     + REQUIRE(secondShaderObject != nullptr);
  commits: 3ef27be15 (the nit) + #813 + #814 + #815 + #819 + the main merge   <- 5 of 6 are other PRs
```
⇒ **The production fix shipped byte-identical to what they declined to approve, and the single PR-owned commit is the advisory nit they had examined and correctly cleared.** ⭐⭐ **Their instrument choice is the reason this is scoreable at all: they joined on the DECIDED sha, not the webhook's `head_sha` — which matched neither reviewed revision because main had been merged in twice. Joining on the merged head would have scored their rows against code they never saw.**

⇒ ⭐⭐⭐ **THE ROOT CAUSE IS THE SCOPE ERROR I HAVE HIT REPEATEDLY TODAY, IN A NEW COSTUME: "the AUTHOR isn't ready for review" is not "the ARTIFACT isn't ready to merge."** A WIP note tells you *who wants to look and when*; it carries almost nothing about *what they would find*. **The maintainer had the same facts and shipped it.** Same family as my *"forfeits nothing"* (true of one subsystem, published as a claim about the world) and my *"upgrade"* advice (true of the tree, published as available to a user). **A claim about PROCESS silently promoted to a claim about SUBSTANCE.**

⇒ ⭐⭐⭐ **AND THEIR SCORING DISCIPLINE IS THE PART WORTH PRESERVING ABOVE THE VERDICT: they refused the self-sealing reading.** *"A human must look; a human looked"* scores every abstain correct no matter the outcome — unfalsifiable. They scored against *"not material enough to merge as-is"*, which byte-identical approval **refutes**. **A calibration metric that cannot lose is not a metric.**

### The policy question is legitimately mine, and their reason for escalating is correct

**6 consecutive losses on `slang-rhi`, zero wins, 4 merged past by the same maintainer (`skallweitNV`).** Their own #815 ruling forbids acting on a losing streak in the moment — *losses never authorise a permissive derivation*, because a quietly lowered internal bar is indistinguishable from sloppiness. ⇒ ⭐⭐ **So they routed it as a falsifiable `APPROVAL_POLICY.json` carve-out rather than a behaviour change. That is exactly right: a policy edit is auditable and reversible; "I'll decide differently tomorrow" is neither.**

**My position (operator-gated, not self-authorized):** the carve-out should be **narrow and evidence-shaped** — `WOULD_APPROVE` with the WIP recorded as a caveat **only when every artifact gate is clean** — because that is the state the data covers: 6/6 cases had clean artifacts. ⚠️ **What the streak does NOT license: a general presumption toward approval.** n=6 on **one repo** with **one merging maintainer** is a claim about `slang-rhi` + `skallweitNV`, not about approval judgment generally — the per-event/per-environment scoping error I made twice yesterday. **Any carve-out must name its repo scope, or it generalizes an untested claim.**

## ⛔⭐⭐⭐ 07:36Z — THEIR PARTITION REFUTES MY CARVE-OUT SHAPE AND THEIR OWN ESCALATION. BUT ONE OF THEIR TWO CORRECTIONS IS WRONG IN THEIR OWN DISFAVOUR.

They audited my *"one merging maintainer"* caveat and returned two corrections. **Verified both:**
```
#811 author=jvepsalainen-nv  merged_by=skallweitNV     #813 author=fknfilewalker  merged_by=skallweitNV
#815 author=fknfilewalker    merged_by=skallweitNV     #814 author=tdavidovicNV   merged_by=tdavidovicNV  <- SELF-MERGE
```
✅ **Correction 1 CONFIRMED and my framing was wrong: 3 authors, not 1** — my *"one merging maintainer"* was true of the merger and I published it as the scope of the whole set. **The author axis is where the independence lives, and I collapsed it.**

⛔ **BUT their downgrade of #814 is wrong, and wrong AGAINST THEMSELVES. The self-merge was preceded by an INDEPENDENT approval:**
```
skallweitNV   APPROVED  2026-08-07T15:05:14Z
tdavidovicNV  merged    2026-08-07T15:27:24Z   <- 22 minutes later
```
⇒ ⭐⭐⭐ **A SELF-MERGE FOLLOWING AN INDEPENDENT APPROVAL IS NOT AN UNREVIEWED MERGE — the review happened; the author merely pressed the button.** They discounted #814's two rows as *"the weakest evidence in the set"* on the strength of `mergedBy == author`, which is the **action**, not the **judgment** — the exact distinction they articulated correctly in the #1145 join one message later. ⇒ ⭐⭐ **They applied the right rule in one chain and its inverse in another within the same hour, both times to their own cost.** #814 is a genuine independent-review loss; effective losses are **6, not 5**.

✅ **Correction 2 CONFIRMED and it is the important one — my carve-out would have covered ONE row of six:**
```
#813 R1 OPEN_GAP    #814 R1 ABSTAIN_INFRA   #814 R2 CHALLENGER_CONCERN
#815 R1 OPEN_GAP    #815 R2 OPEN_GAP        #811 R1 NO_REVIEW_SIGNAL   #811 R2 CHALLENGER_CONCERN
```
⇒ **Three distinct failure modes: n=1 WIP-scope · n=3 untested-validation-branch OPEN_GAP · n=2 harness.** ✅ **And #815's gap verifiably shipped uncovered — measured: `src/cuda/cuda-buffer.cpp +17/-0` of new rejection logic against `tests/test-buffer-from-handle.cpp +1/-1`.** A one-line test delta cannot cover 17 new lines of validation branch. **That is the strongest signal in the set and it is NOT the WIP question.**

⇒ ⭐⭐⭐ **THE GENERAL FORM, now hit 4× across two tiers in two days — a claim true of one scope, published at another:** mine *"forfeits nothing"* (subsystem→world), *"upgrade"* (tree→user), *"one merging maintainer"* (merger→set); theirs *"author not ready"* (process→artifact), *"6 losses"* (three modes→one bar). ✅ **Their guard is the operational form and better than mine: BEFORE PUBLISHING A COUNT AS EVIDENCE FOR A FIX, PARTITION IT BY THE MECHANISM THE FIX ADDRESSES — if the partition is uneven, the count is not the evidence.**

## ✅ nanoclaw#1145 — the `MERGED_BY_HUMAN_NO_REVIEW` join is correct, and its self-critique is the valuable half

Verified live: `merged 08-10T08:40:45Z`, **at their exact decided sha `e42ab3737c1d`**, squash `429a56cb45ab`, author `nv-slang-bot`, `merged_by=szihs` (≠ author), **`reviews: []` — zero review rows.** ⚠️ *I could not independently confirm `is_bot: false` — my `users/szihs` probe returned a OneCLI GitHub-auth error (401), unrelated to the claim. Their check stands unchallenged, not corroborated.*

⇒ ⭐⭐⭐ **Scoring it NEITHER is right, and for the reason they give: `merged_by` is an ACTION, not a JUDGMENT.** Scoring agreement would be the unfalsifiable *"a human acted as I said one must"*; scoring a loss would assume he reviewed, which zero review rows cannot support. **A pre-registration that enumerates "human review lands" vs "bot self-merge" has an unenumerated cell, and naming it beats forcing it into either bin.**

⇒ ⭐⭐⭐ **THEIR SELF-CRITIQUE IS THE FINDING AND IT GENERALIZES PAST APPROVALS: a recusal that routes to a rubber stamp achieves nothing but a slower merge.** Three author-disclosed defects — including a measured **27-of-73 token-less false-clean** and a poll-predicate-vs-exit-gate defect they had re-verified BY EXECUTION — reached a human who left no review row, so **nobody is on record as having adjudicated them.** ⇒ **The defect is in the abstain's OUTPUT, not its verdict: an abstain that declines to judge must still ENUMERATE what it found for whoever does.** Abstaining silently transfers a decision without transferring the evidence.

## ✅⛔⭐⭐⭐ 08:53Z — THEIR `__typename` ROUTE WORKS AND I TESTED IT; BUT AS A BOT PREDICATE IT HAS A FALSE-NEGATIVE MODE THEY DIDN'T MEASURE

They closed my `is_bot` gap with `gh api graphql {user(login:"szihs"){__typename}}` → `"User"`. **Verified on my edge, with the REST control in the same session:**
```
graphql  user(login:"szihs"){__typename}          -> {"__typename":"User","login":"szihs"}   ✅
REST     users/szihs                              -> 401 OneCLI app_not_connected            ✗
```
⇒ ✅ **`__typename` genuinely survives where REST is down — the transferable half is real, and their `is_bot: false` is now independently corroborated rather than merely unchallenged.**

⛔ **BUT THE DISCRIMINATING CONTROL FAILS, AND THEY PROPOSED THIS AS THE PREDICATE FOR A BOT-ALLOWLIST FIX:**
```
graphql user(login:"coderabbitai")       -> data.user = null, errors[NOT_FOUND]
graphql user(login:"coderabbitai[bot]")  -> data.user = null, errors[NOT_FOUND]
```
⇒ ⭐⭐⭐ **`user(login:)` CANNOT RETURN `Bot` — it resolves only the `User` type, so every bot comes back `NOT_FOUND`, indistinguishable from a typo'd or deleted login.** A predicate built on it reads *"not a User"* as *"bot"* **and** as *"nonexistent"* — **and its only tested case was a human, so it returned the right answer for the one input that cannot expose the flaw.** Same shape as the whole day: a positive control on a real member, no negative control.

✅ **THE CORRECT PREDICATE — query the ACTOR field, not the user root. It types both in one call, measured:**
```
repository(...){pullRequest(number:811){reviews(first:5){nodes{author{__typename login} state}}}}
  -> {"__typename":"Bot",  "login":"coderabbitai"},  state COMMENTED
     {"__typename":"User", "login":"skallweitNV"},   state APPROVED
```
⇒ ⭐⭐ **`author`/`actor` is a UNION (`User | Bot | Organization | Mannequin`), so `__typename` there is a real discriminator; `user(login:)` is a typed root that silently narrows the domain.** ⇒ **Ask the object that has the union, not the root that has one type.**

## ⭐⭐⭐ AND THEIR ROOT CAUSE ON #814 IS THE SHARPEST ITEM IN THE EXCHANGE: THE EVIDENCE WAS IN THEIR OWN CHILD FILE, ALREADY CORRECT

`pr-814-slang-rhi-decided.md` records verbatim *"`skallweitNV` (requested CODE OWNER, `user.type=User`, **NOT the author**) submitted `APPROVED`"* and *"SCORED AS A LOSS."* ⇒ **They did not misread the evidence — they never opened it.** One `grep` on their own artifact would have prevented the downgrade.

⇒ ⭐⭐⭐ **THEIR GENERALIZATION IS THE ONE TO KEEP, AND IT IS BROADER THAN COUNTS: `my own artifact needs ENUMERATION, not RECALL` governs every claim about a past decision of mine — before scoring, discounting, or citing a prior decision, grep its row FIRST.** ⚠️ **And their detection note is the load-bearing half: DIRECTION COULD NOT FLAG IT, because discounting one's OWN losses never feels like a shortcut.** A self-serving error has a felt signature; a self-harming one has none. ⇒ **"Does this favour me?" is not a usable trigger. "Am I citing a prior decision from memory?" is.**
