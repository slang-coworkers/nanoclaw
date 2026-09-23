---
name: project_12376_fossil_oob_relative_ptr
description: "slang#12376 fossil OOB read. TERMINAL 08-26: maintainer jkwak-work closed it WNF and closed PR #12354 UNMERGED — the core-module-validation startup cost (≈2s/process on the 17MB core module) was disqualifying, not any analysis defect. Both triage escalations (the kNullOffset walk-bypass + the missing rejection test) were ACTIONED before the close (a 20-case negative test was added). A WNF is a triage WIN."
metadata:
  node_type: memory
  type: project
  originSessionId: 9119cce4-1876-4df9-a20f-8481b119a65b
---

**shader-slang/slang#12376** — "Fossil deserialization follows relative pointers without bounds checking." Filed 2026-08-06 by `jkwak-work` (maintainer, also the PR author), `[Security]`, labels `bug`+`Dev Opened`, milestone Q3 2026. Canonical thread `gh-issue-shader-slang/slang-12376`.

⭐ **Routing fact: NOT unowned incoming work.** The issue was filed *after* PR [#12354](https://github.com/shader-slang/slang/pull/12354) (`Fixes #12376`, author+assignee `jkwak-work`) to give the fix a citable tracking issue and record its deliberate follow-ups. ⇒ triage's job was **verify-and-route, not diagnose** — subsystem, severity, repro, and fix were all already written by the maintainer.

## ✅ TERMINAL 08-26 — WNF, PR NOT MERGED

`jkwak-work` closed #12376 as won't-fix (cmt 5419250542) and closed #12354 unmerged. Stated reason: the implementation "makes the slang-test run significantly slower and it is not usable." ⇒ the close is on the **performance tradeoff the whole design rested on** — validating the trusted 17MB core module on every `slangc` startup (≈2 s/process, follow-up (a)) — not on any defect in the analysis. That cost was the design's known Achilles heel from day one; it turned out disqualifying, not just expensive.

⭐⭐ **Both concerns triage escalated on 08-06 were ACTIONED before the close — the escalation worked even though the PR died:** the 🔴 `kNullOffset` bypass got a dedicated case in a new `tools/slang-unit-test/unit-test-fossil-validation.cpp` (20 negative cases incl. the null-sentinel collision, OOB roots, bad layout kinds, string/terminator, record/container bounds, zero stride, truncation, cyclic-graph termination, a work cap against quadratic blow-up). The maintainer also added a "What the walk does and does not guarantee" section conceding readers navigate by unchecked `cast<>` at static offsets, so the walk proves *reachability*, not *conformance*.

**Disposition:** NO GitHub post (maintainer closed his own issue+PR with a decisive reason, no question to answer; a bot ack would be a forbidden meta-ack); upstream report to the operator only. CO-TRIGGER (merge auto-closing #12376) can no longer fire.

## The bug (from the issue/PR)

`Fossil::getRootValue()` (`source/slang/slang-fossil.cpp`) is the trust boundary: it checks buffer ≥ header size, magic bytes, and `totalSizeIncludingHeader ≤ size`, then follows `header->rootValue` (a `RelativePtr32`, resolved `thisAddr + intptr_t(_offset)` from the file — so it can name any address within ±2GiB). Only a null check guards the first dereference. First real OOB read is `(*layoutPtrPtr).get()` at `slang-fossil.h:1205` (**computing an address ≠ dereferencing it** — `RelativePtr::get()` reads its own in-header member and only computes). Read primitive only ⇒ realistic outcomes are **DoS + adjacent-memory disclosure, not code execution** (offset `0x7F000000` → crash; just past end-of-buffer → reads adjacent heap and surfaces it through a `cannot open file` diagnostic — an info-disclosure primitive). Exposure is ordinary: `.slang-module` files are distributed like any build artifact.

## Load-bearing gotchas for anyone designing/reviewing a fix

- **`Header::totalSizeIncludingHeader` cannot be used as the bound** — `SerialWriter::_initialize()` writes it as **zero** and never back-patches it, so every blob Slang emits reports its own size as 0 (confirmed on a real 5.8MB module). ⇒ **the existing `reportedSize > size` check is vacuous and has never rejected anything.** A check that cannot fire is not a check; do not count it as prior protection. See [[feedback_a_negative_control_must_vary_exactly_one_thing]].
- **Why the pre-existing `SLANG_SERIALIZE_FOSSIL_VALIDATE` didn't catch it:** it guards type confusion by testing `layout->kind`, but *reading* `layout->kind` **is** the OOB read — the guard sits downstream of the dereference it would protect. Type validation and bounds validation are orthogonal.
- **Bounds-checking inside `RelativePtr32::get()` is the wrong layer** — `RelativePtr` lives in `source/core/`, is generic infra with no buffer knowledge, and is used on the write path too.

**What #12354 did:** a one-time validating walk at the trust boundary (`slang-fossil-validate.cpp`, `validateRootValue()` behind the `SLANG_ENABLE_VALIDATION_FOSSIL` CMake option, off by default), with an explicit work list + visited set keyed on `(data, layout, form)` (recursion would let a nested blob overflow the stack; without exact memoization a crafted dedup'd/cyclic graph is exponential), resolving pointers in the **offset domain** (merely *forming* an escaped pointer is UB even unread) and reading via `memcpy` (a hostile blob need not align). ⚠️ Turning the option off also turns off the previously-on type/kind checks ⇒ a stock build has *less* protection than before (stated as intentional).

## The 🔴 walk-bypass finding (the sharp one, credited to a review bot)

Review thread `3717966165` (unresolved, 7 commits old) exposed that the security fix bypasses its own walk: `kNullOffset = -1`; `_readRelativePtr()` decides null from the **raw** stored offset (`== 0`) but returns the **computed** target otherwise; call sites compare the *computed* value against `kNullOffset` and skip queueing on a match. Craft raw `relativeOffset = -1 - offset` ⇒ computed result is exactly `-1` ⇒ the walk treats a real pointer as null and never validates its target, while the consumer `RelativePtr::get()` returns `base - 1` and dereferences it. Modelled at D = 0…2³¹-2, all yield `-1`, with both controls firing (genuine nulls still map to the sentinel; ordinary forward pointers do not collide). ⇒ **the walk's whole guarantee is defeated by one crafted offset, in the PR that exists to establish it** — and it earned a pinning negative test before the abandonment.

## Reusable rules this chain produced

- **A scope brief bounds the QUESTION, never the bug class.** The brief was "confirm these two facts"; neither party asked whether the *fix* contained an instance of the same class — it did, unresolved. **Before ranking pre-merge priorities on any fix PR, census its UNRESOLVED review threads** (`reviewThreads{nodes{isResolved isOutdated …}}`; `isResolved=false, isOutdated=false` = still open AND on current code). See [[feedback_a_scope_brief_bounds_the_question_not_the_bug_class]].
- **A concern that must be re-discovered to persist is not recorded** — resolution had already erased the "no rejection test" and "default-flip" concerns once; they survived only because a bot re-found them.
- **Pin the SHA in every CI claim** — two agents citing "the same commit" while holding different HEADs (`0c7f96d0b` vs `4bac3b2d2`) produced a false disagreement about which `test-slang` legs were red; `mergeable_state`/red-set staled within minutes.
- **A WNF/close-unmerged is a WIN for a triage chain, not a loss** — a fix PR can be technically hardened to completion and still be correctly abandoned on a non-technical axis (startup cost); "review concerns all addressed" ≠ "will merge."
- **Never write bare `closed` here** — it collides with the auto-close #12376 gets when #12354 merges; always "chain closed / issue open." See [[feedback_a_status_word_that_collides_with_the_target_systems_own_state]].
- When a hook blocks a shell route (`gh api graphql` denied), the MCP tool surface is the fallback — don't retry the denied command verbatim; a transient `app_not_connected` 401 that succeeds on immediate retry is not a broken PAT.

Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]], [[feedback_never_cite_a_peers_artifact_by_your_own_local_name]], [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
