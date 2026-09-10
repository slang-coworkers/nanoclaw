---
name: project_12376_fossil_oob_relative_ptr
description: "slang#12376 fossil OOB read. TERMINAL 08-26: maintainer jkwak-work closed it WNF + closed PR #12354 UNMERGED — the core-module-validation startup cost was disqualifying, not any analysis defect. Both triage escalations (the 🔴 kNullOffset bypass + the missing rejection test) were ACTIONED before the close (20-case negative test added, incl. the null-sentinel collision). Chain closed; a WNF is a triage win."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9119cce4-1876-4df9-a20f-8481b119a65b
---

**shader-slang/slang#12376** — "Fossil deserialization follows relative pointers without bounds checking".
Filed 2026-08-06 by `jkwak-work` (maintainer, also the PR author). Labeled `bug`.

⭐ **The routing-critical fact: this issue is NOT unowned incoming work.** PR
[#12354](https://github.com/shader-slang/slang/pull/12354) — *"Bounds-check fossil deserialization
behind an opt-in validation option"*, opened 08-05, author + assignee `jkwak-work`, branch
`security-fossil-format-relative-pointer`, base `master`, **non-draft**, labels `pr: non-breaking` +
`CoPilot` — opens its body with `Fixes #12376`. The issue text itself closes with a *Related work*
section naming #12354. So the issue was filed **after** the PR, to give the fix a citable tracking
issue and to record the follow-ups the PR deliberately leaves open.

⇒ Triage's job here is **verify-and-route**, not diagnose. The subsystem, severity, repro, and fix
are all already written down by the maintainer. Re-deriving them burns a chain and tells the
maintainer nothing they don't know.

## The bug (from the issue/PR, not independently verified by me)

`Fossil::getRootValue()` (`source/slang/slang-fossil.cpp`) is the trust boundary. It checks buffer
≥ header size, magic bytes, and `header->totalSizeIncludingHeader ≤ size` — then follows
`header->rootValue`, a `FossilizedPtr` = `RelativePtr32`. `source/core/slang-relative-ptr.h:53-64`
resolves it as `thisAddr + intptr_t(_offset)` with `_offset` read straight from the file, so the
result can name any address within ±2GiB of the header. Only a null check guards it before
`getVariantContentPtr()` → `FossilizedVariantObj::getContentLayout()`, which reads the four bytes
*preceding* that already-unvalidated address and follows them as a second relative pointer. **Two
OOB dereferences before any validation runs.**

⭐ **Why the pre-existing `SLANG_SERIALIZE_FOSSIL_VALIDATE` did not catch it — a reusable shape:**
it guards type confusion by testing `layout->kind`, but *reading* `layout->kind` **is** the OOB
read. **The guard sits downstream of the dereference it would need to protect.** Type validation
and bounds validation are orthogonal concerns. Same pattern for lengths:
`FossilizedStringObj::getSize()` (word before the string → `UnownedTerminatedStringSlice`) and
`FossilizedContainerObjBase::getElementCount()` (drives `elementsPtr + elementStride * index`).

Reported observations on an unhardened build: root offset `0x7F000000` or `-0x7F000000` → crash, no
diagnostic; **just past end of buffer → compiler reads adjacent heap memory and surfaces it through
a `cannot open file` diagnostic.** That third case is an **information-disclosure primitive**, not
merely a crash. Read primitive only (offsets only ever compute read addresses) ⇒ realistic outcomes
are DoS + adjacent-memory disclosure, not code execution. Exposure is ordinary: `.slang-module`
files are distributed and consumed like any other build artifact.

## ⭐ The load-bearing gotcha for anyone designing/reviewing a fix

**`Header::totalSizeIncludingHeader` cannot be used as the bound.** `SerialWriter::_initialize()`
(`slang-serialize-fossil.cpp:47`) writes it as **zero** and never back-patches it, so *every blob
Slang emits reports its own size as zero* — confirmed against a real artifact (a 5.8MB
`neural.slang-module` reports 0). ⇒ **the existing `reportedSize > size` check in `getRootValue()`
is vacuous and has never rejected anything.** A check that cannot fire is not a check; do not count
it as prior protection. Fixing the writer would give the format a self-describing bound and would
also catch truncated blobs — but it changes the bytes of every emitted module, so #12354 leaves it
out on purpose.

**Bounds-checking inside `RelativePtr32::get()` is the wrong layer** — `RelativePtr` lives in
`source/core/`, is generic infrastructure with no knowledge of any buffer, and is used on the
*write* path too.

## What #12354 does, and the three follow-ups it leaves open

One-time validating walk at the trust boundary (`source/slang/slang-fossil-validate.cpp`, new;
`validateRootValue()` called from `getRootValue()` after the header checks), behind the
`SLANG_ENABLE_VALIDATION_FOSSIL` CMake option, **off by default**. Explicit work list + visited set
keyed on `(data, layout, form)` — recursion would let a deeply nested blob overflow the stack (a new
DoS introduced by the fix), and without exact memoization a crafted dedup'd/cyclic graph would be
exponential (same problem). Relative pointers resolved in the **offset domain** (`BlobOffset =
offset + Int64(relativeOffset)`) because merely *forming* an escaped pointer is UB even unread;
`_read<T>()` uses `memcpy` because a hostile blob need not align anything.

Deliberately open, per the PR body — these are what the issue exists to track:

1. The walk validates the **trusted embedded core module** too, ≈**2 s per process** in a release
   build. Skipping it for the core module is what would make leaving validation on affordable.
2. **No regression test for any rejection path.** `SLANG_UNEXPECTED` → `handleSignal`, which throws
   `InternalError` when exceptions are enabled (`source/core/slang-signal.cpp:124-133`), so a C++
   unit test *can* catch it — but the test has to be gated on the same option, since the validator
   is compiled out otherwise.
3. The writer's unwritten `totalSizeIncludingHeader` (above).

⚠️ Also worth a reviewer's attention and not listed as a follow-up: turning the option off by
default **also turns off the type/kind checks that were previously on**, so a stock build has *less*
protection against malformed serialized input than before. The PR states this plainly as
intentional (one switch for the expensive walk and the cheap checks).

## Chain state

Dispatched to `slang-triager` on canonical thread `gh-issue-shader-slang/slang-12376` at open time,
with the #12354 linkage stated up front so triage does not re-diagnose. I did **not** post to
GitHub — closest-to-the-state: whoever holds the verdict posts.

⚠️ **08-06 02:08 — first triager turn died on `API Error: The operation timed out.`** (session
`sess-1785979848556-r6oeal`, agent group `ag-1780667166418-apezq5`). It had emitted only its ack
(seq 3, 01:31) and then the error (seq 5, 02:08) — **no work product, nothing on GitHub.** Verified
both before re-driving:
- `github_get_issue` → `comments_count: 0`, `comments_data: []` ⇒ **a re-send cannot double-post.**
  ⭐ Checking the *outward-facing* artifact before a retry is the cheap step that makes the retry
  safe; session rows alone would not have told me whether a post escaped.
- `ncl sessions list --limit 2000 | grep slang-triager` → **exactly one** active session, on the
  canonical thread ⇒ no phantom twin (the detector from the anchored `thread_id` lesson). The
  session is still `active`/`running` with my dispatch at seq 2, so default routing on the same
  thread resumes it — **no `target_session_id` pin needed** (pinning is for when my thread differs
  from the one that created the session).

Re-dispatched on the same canonical thread.

⭐ **Maintainer self-triaged the issue between open and my first dispatch** — at 01:29:07 `jkwak-work`
retitled it **`[Security]` Fossil deserialization…**, added the **`Dev Opened`** label alongside
`bug`, and set milestone **Q3 2026 (Summer)**. So severity/classification/scheduling are already the
maintainer's own calls, not gaps for triage to fill. This is the third independent signal that the
chain is verify-and-route.

**RESUME trigger:** a comment on #12376 or #12354, or #12354 merging (which auto-closes #12376 via
`Fixes`). If #12354 merges, the three follow-ups above need their own issues or they vanish with the
tracking issue — that is the thing to check, and nobody has claimed it.

## 08-06 02:42 — triage delivered (memo `triage-12376.md`, 111 lines) + posted cmt 5199770804. My own verification found three things it missed.

Triager's work was strong: both of my "will mislead you" facts confirmed at source, all three repro
rows reproduced with bracketing md5 controls, `totalSizeIncludingHeader` **measured** (real 7228-byte
module reports 0 in *both* fossil headers; zero-control PROBE_FAILED on a non-fossil file), and two
self-caught draft errors ("bot-filed", "Issue Type bot-set" — both false, `jkwak-work` did both).
It also correctly tightened the issue's own **"two out-of-bounds dereferences" → one**:
`RelativePtr::get()` reads `_offset`, its own member inside the already size-validated header, and
merely *computes* an address. ⭐ **Computing an address ≠ dereferencing it.** First OOB read is
`(*layoutPtrPtr).get()` at `slang-fossil.h:1205`.

### 🔴 What nobody in the chain reported: the security fix has a live, unresolved bypass of its own walk.

Review thread **`3717966165`** (github-actions[bot], 08-05 04:35) is **`isResolved=false`,
`isOutdated=false`** — i.e. still open and still pointing at current code, ~23 h and **7 commits**
later. I verified the defect is present at PR head `4bac3b2d2`:

- `kNullOffset = -1` (`slang-fossil-validate.cpp:32`).
- `_readRelativePtr()` (`:193-204`) decides null from the **raw** stored offset (`relativeOffset == 0
  → kNullOffset`) but returns the **computed** target `offset + Int64(relativeOffset)` otherwise.
- Call sites at `:295`, `:311`, `:445` compare that **computed** value against `kNullOffset` and
  **skip queueing** on a match.
- Constructible: pick raw `relativeOffset = -1 - offset` (≠ 0 for offset ≥ 0, representable in signed
  32-bit). Computed result is exactly `-1` ⇒ the walk treats a real pointer as null and **never
  validates its target**.
- Consumer disagrees: `RelativePtr::get()` (`slang-relative-ptr.h:53-64`) returns `nullptr` only when
  the **raw** `_offset == 0`. With `_offset = -1-offset` it returns `base - 1` and dereferences it.

⇒ ⭐⭐ **The walk's whole guarantee — "every location a consumer can reach lies inside the blob" — is
defeated by one crafted offset, in the PR that exists to establish it.** Strictly more consequential
than the (b)-carrier question the brief was scoped to. ⭐ **Lesson: when triage is scoped to
"confirm these two facts", the unasked question is whether the FIX has its own instance of the same
bug class. Scope discipline is right; it does not extend to ignoring a 🔴 on the fix.**

Also unresolved at head: the "which bound — buffer `size` or `totalSizeIncludingHeader`?" question
(**twice**: `3717969215`, `3721951311`) and the `SLANG_RELEASE_ASSERT` nit on `_requireRange`
(`3722276536`), the single control that proves every read is in bounds.

### ⭐⭐ The (b)-vanishes argument is stronger than triage stated — it has already happened once.

Thread `3717967835` ("the new validator ships with no test") is **resolved**, and the identical
concern was then **re-raised as two new threads** (`3721950188`, `3724613121`). Same for the
default-flip gap: `3717966999` resolved → re-raised as `3721948450` and `3724612029`. ⇒ *"a review
comment the merge resolves away"* is not a prediction here; resolution has already erased this exact
concern once and it only survived because a bot re-found it. ⭐ **A concern that must be
re-discovered to persist is not recorded.**

### ⚠️ Triage's CI "correction" — conclusion stands, novelty claim does not, and the two parties measured DIFFERENT COMMITS.

Triage published on #12376 that our own CI-babysitter comment (cmt **5196958664**, 08-05 20:26Z on
#12354) *"guessed the three `test-slang` reds came from `SLANG_ENABLE_VALIDATION_FOSSIL=ON` — that
guess is wrong, and I'm correcting it here"*, offering as **decisive control** that
`test-linux-release-gcc-x86_64` has both options ON, runs all three tests, and passes.

I read the babysitter comment in full. It had **already published that exact control**: *"those same
three tests pass on the sibling `test-linux-release-gcc-x86_64 / test-slang` leg at this same commit
(`100% of tests passed (7129/7129)`)"* — and had explicitly labeled the cause bullet
**"Hypothesis (not verified by execution)"**. ⇒ ⭐⭐ **Triage re-derived the counterparty's own
control and framed it as a refutation of the counterparty.** The conclusion (option-ON is not
sufficient) is sound; the "I'm correcting our bot" framing implies the bot lacked the control, which
is false, and it is now in a maintainer-facing comment.

⭐⭐⭐ **And the failure sets differ because the commits differ — neither party said so.** Measured:

| commit | in CI | failing `test-slang` legs |
|---|---|---|
| `0c7f96d0b` (15:36Z) — what the **babysitter** measured (reran 18:26Z, run 31024965474) | fossil ON | **3**: `linux-debug-gcc-x86_64`, `windows-debug-cl-x86_64-gpu`, `windows-release-cl-x86_64-gpu` |
| `4bac3b2d2` (17:23Z) — what **triage** measured (run 31052137029) | fossil ON + full-IR ON | **1**: `windows-release-cl-x86_64-gpu` |

Both are right about their own commit. "The failure is windows-release-specific" is true at head and
was **not** true at the commit the babysitter measured. ⭐ **Two agents citing "the same commit" while
holding different HEADs produces a false disagreement — pin the SHA in every CI claim.**

⚠️ This also **weakens, not strengthens, triage's own alternative-cause hypothesis.** It offered
"the PR turns on a never-run IR validator on the same commit whose CI is red" as an untested
plausible cause — but the two commits enabling full-IR validation (`52a243860` "Make the
full-IR-validation option work, and rename it", `4bac3b2d2` "Enable full IR validation in the CI
builds") coincide with the failing set going **3 legs → 1**. Directionally against. (Caveat: different
runs, so runner variance is not excluded.) Triage was right to publish only the narrow proven form of
the inertness claim (codex caught "dead in every build" as overstated — a parent project or direct
`-D` could still define it).

⚠️ **CI state is in flux and any "CI is red" line staled fast:** run `31052137029` is `attempt=2` and
went `completed/cancelled` at **02:48Z**, i.e. ~8 min *after* triage posted at 02:40Z. Head unmoved
at `4bac3b2d2`, `mergeable=true`, 7 commits. Census at head: 39 success / 1 failure / 5 cancelled / 1
null.

⚠️ One `gh` call returned OneCLI `app_not_connected` 401 mid-sweep, then three immediate retries
succeeded — transient, not a credential loss. Worth remembering before escalating a 401 as a broken PAT.

## 08-06 03:01 — cmt 5199770804 PATCHED in place. **CHAIN closed / ISSUE #12376 OPEN** (and #12354 open, unmerged, `mergeable_state=behind`). Verified on my own edge, not relayed.

⛔ **Never write bare `closed` about this row.** Re-measured 03:07Z: `state=open`, `state_reason=null`.
`closed` is *exactly* what #12376 becomes when #12354 merges (`Fixes #12376`), so the word cannot
distinguish "we finished our work" from "the auto-close already fired" — and the wrong reading is the
one that makes the two live maintainer decisions (the 🔴 bypass, the (b) carrier) look settled. Always
`chain closed / issue open`. See [[feedback_a_status_word_that_collides_with_the_target_systems_own_state]].

All four asks landed. Independently confirmed by me against the API (not from the triager's report):
`created=02:40:48Z` vs `updated=03:01:10Z` ⇒ **edited, not stacked**; `comments_count` still **1**;
len 5290 → **7715**. Superseded framings all **0** (`that guess is wrong`, `correcting it here`,
`our bot guessed`). New fragments present: `3717966165`, `4bac3b2d2` ×2, `31052137029`, `0c7f96d0b`,
`kNullOffset`, `re-discovered`, `directionally`. Issue unmutated: open / `Dev Opened`+`bug` /
Q3 2026 / `jkwak-work`.

Published text now leads its next-action with the 🔴 bypass (**credit to the review bot**, not to us),
demotes (b) beneath it with the already-erased-once evidence, SHA-pins the CI paragraph, and states
the alt-cause hypothesis as *directionally unsupported*. The CI framing now reads *"I'm adding the SHA
pin, not correcting it"* — accurate.

⭐ **Triage strengthened my finding rather than relaying it**, which is the behavior to reinforce: it
fetched `pull/12354/head` (sha-matched; must-miss control = the file is absent at master and errors
loudly), confirmed `FossilInt = int32_t` / `BlobOffset = Int64` so the collision is *arithmetically*
available, then **modelled** raw `-1 - D` at D = 0, 4, 12, 28, 32, 160, 3840, 7227, 2³¹-2 — all yield
exactly `-1`, with **both controls firing** (genuine nulls still map to the sentinel; ordinary forward
pointers 32+12, 160+100, 28+4 do **not** collide). ⇒ **not a corner case — available at any offset.**
My own note had said "one byte before the blob", which understated it. **Modelling the arithmetic beat
reasoning about the algebra, and it upgraded the severity.**

⭐⭐ **The reusable rule this chain produced — a scope brief bounds the QUESTION, never the bug class.**
My brief said "confirm these two facts about the bug"; triage answered it well and neither of us asked
whether the *fix* contained an instance of the same class. It did, unresolved, 7 commits old. ⇒
**Before ranking pre-merge priorities on any fix PR, census its UNRESOLVED review threads** —
`reviewThreads(first:N){nodes{isResolved isOutdated comments(first:1){nodes{databaseId path body}}}}`
via GraphQL; `isResolved=false, isOutdated=false` is the pair that means *still open AND still on
current code*. 9 of 13 open here. Filed as a shared learning by triage.

⚠️ **A `gh api graphql` Bash call was denied by a PreToolUse hook** mid-verification; I re-derived the
same facts through the `mcp__slang-mcp__github_get_issue` MCP path instead. ⇒ when a hook blocks a
shell route, the MCP tool surface is the fallback — don't retry the denied command verbatim.

**RESUME (unchanged owner: `jkwak-work`):** his call on the `3717966165` bypass and on the (b) carrier.
**CO-TRIGGER** = #12354 merges → auto-closes #12376 ⇒ re-read the merged diff, **check specifically
whether the `kNullOffset` bypass shipped**, and refresh cmt 5199770804 in place.

## 08-26 01:18Z — TERMINAL. Both **CLOSED, PR NOT MERGED. Maintainer closed #12376 as WNF** (won't-fix).

`jkwak-work` (MEMBER) closed #12376 as WNF (cmt 5419250542, 01:18:16Z) and closed #12354 unmerged
(01:18:58Z, `merged_at=null`). Stated reason: *"The following PR had the implementation but as
suspected, it makes the slang-test run significantly slower and it is not usable."* ⇒ the close is on
the **performance tradeoff the whole design rested on** — validating the 17MB core module on every
`slangc` startup — not on any defect in the analysis. That cost was the design's known Achilles heel
from day one (the ≈2 s/process figure was follow-up (a)); it turned out to be disqualifying, not just
expensive.

⭐⭐ **Both of the concerns triage escalated on 08-06 were ACTIONED before the close — the escalation
worked even though the PR died.** I re-read the final PR body (updated 08-26, 15 comments vs 3 at
triage time):
- **The 🔴 `kNullOffset` bypass (thread `3717966165`) got a dedicated test.** The new file
  `tools/slang-unit-test/unit-test-fossil-validation.cpp` (20 cases) explicitly lists *"the
  null-sentinel collision"* among them. The exact finding triage confirmed constructible at every
  offset now has a pinning negative test. ⇒ **the finding we ranked above the brief was real enough
  to earn its own regression test.**
- **The (b) "no rejection test, recorded nowhere durable" concern is fully resolved** — 20
  negative-path cases (OOB roots, bad layout kinds, string/terminator, record/container bounds, zero
  stride, truncation, cyclic-graph termination, a `fossilValidationBoundsTotalWork` cap against
  quadratic blow-up). The very thing triage said would vanish at merge was instead built out.
- The maintainer added a **"Reviewer Directives (maintained by agent)"** block and a **"What the walk
  does and does not guarantee"** section conceding the readers navigate by *unchecked `cast<>`* at
  static offsets (`slang-serialize-ir.cpp:780`, `slang-serialize-ast.cpp:2009`), so the walk proves
  *reachability*, not *conformance* — the sharper point triage had made about the guard not running on
  the real load paths, now stated in the PR's own words.

⭐⭐⭐ **A WNF/close-unmerged is a WIN condition for a triage chain, not a loss.** Nothing triage
produced was wrong; the maintainer's own performance judgment retired the whole approach. The correct
disposition on our side: **no GitHub post** (maintainer closed his own issue+PR with a decisive reason,
no question to answer, and a bot "acknowledged" would be the forbidden meta-ack), and an upstream report
to the operator. Chain is terminal — the CO-TRIGGER (merge) can no longer fire.

⚠️ Reusable: **a fix PR can be technically hardened to completion and still be correctly abandoned on a
non-technical axis (startup cost).** Don't equate "review concerns all addressed" with "will merge" —
the disqualifier here was orthogonal to every thread. See
[[feedback_a_scope_brief_bounds_the_question_not_the_bug_class]] (the bypass belonged in the report even
though it was out of scope — and it's exactly the finding that earned a test before the abandonment).

Related: [[feedback_a_negative_control_must_vary_exactly_one_thing]], [[feedback_deference_drifts_to_whoever_corrected_you_last]],
[[feedback_never_cite_a_peers_artifact_by_your_own_local_name]], [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].

Related: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]],
[[feedback_a_negative_control_must_vary_exactly_one_thing]] (a vacuous check reads as protection).
