---
type: chain
title: slang#14103 — IGlobalSession::parseCommandLineArguments returns SLANG_OK for invalid arguments
description: "Human bug (pdeayton-nv, `bot-ok`): invalid argv still parsed OK. TERMINAL: PR #14111 (CommandLineParsePurpose redesign) merged 11-03 21:05Z as f1cd35ff8, #14103 closed completed; slangc follow-up #14195 (jkwak-work, no dispatch) still open."
tags: [slang, api, command-line]
---

# slang#14103 — parseCommandLineArguments ignores parse errors

`Session::parseCommandLineArguments` (`source/slang/slang-global-session.cpp:1153`) called
`tempReq->processCommandLineArguments` and dropped its `SlangResult`, so `-target` with no value (and any other bad argv)
returned `SLANG_OK`, with the diagnostics sent to a temp sink the caller never sees. Dated history (dispatch → un-draft,
SHAs, comment ids, review inboxes): [[slang/14103-history-triage-to-ready.md]] — **new dated entries append there**, not here.

## Current state (TERMINAL, verified 11-04 01:16Z)

| | |
|---|---|
| Issue | #14103 **CLOSED (completed)** 11-03 21:05:21Z; triage cmt 6533041941; thread `gh-issue-shader-slang/slang-14103` |
| PR | **#14111 MERGED** by pdeayton-nv 11-03 21:05:19Z as `f1cd35ff8` (head `cd923c72da`), after three merge-queue evictions caused by infra; final checks 68 pass / 54 skipped / 0 fail |
| Owner | slang-fixer `sess-1793395338785-cyyd6y`. Its `[Fix]` close-out (row 79, 21:07Z) reports worktrees `wt-slang-14103` + `-base` and the `active-work/slang-14103` sentinel removed. No GitHub close-out comment; the merged PR and the closed issue are the terminal artifact |
| Approver | the queued `ready_for_review` in `data/approver-pause-queue.md` is marked MERGED, so it is not dispatched on unpause |
| Follow-up | #14195 (slangc E00045 before several targets; may be `pr: breaking change`), jkwak-work self-assigned. A bot fix needs that maintainer's explicit go-ahead. No dispatch |
| Timer | none. The one-shot `recheck-14111-ready-af0a` fired 11-04 01:15Z and found the chain merged |

## The fix (what cd923c72da does)

- `parseCommandLineArguments` returns the parse result (Approach A) and nulls `*outAllocation` on failure. Returning the
  diagnostic text (Option B) is out of scope by the reporter's direction.
- **`CommandLineParsePurpose`** = CompleteCommandLine (slangc) / CompileRequest (incremental `ICompileRequest`) /
  SessionDescription (this API). Session checks are separated from compile checks instead of suppressing particular
  diagnostics — the maintainer rejected the first version's E00044 `m_isCommandLineCompile` gate as exactly that.
- Session extraction: `-target dxil -profile cs_6_0` is accepted (was E00033); the profile is reduced to its **version**
  (master-equivalent; R3 B1 — keeping the stage broke VS+CS modules with E36107), while explicit capabilities, `+` atoms
  included, are kept and tested against direct `TargetDesc` configuration. Output binding is skipped; `-o` infers a target
  only when no `-target` is given (`-target hlsl -o foo.spv` → HLSL only); output paths are documented as not retained; an
  explicit `-whole-program` is kept, `GenerateWholeProgram` is never synthesized (disclosed per R3 G2).
- The wider E00045 (target options before several targets) applies to SessionDescription only; slangc/CompileRequest stay at
  master behavior, so `pr: non-breaking` holds. slangc's version is #14195.
- Masked breaks fixed on the way: `tests/compute/mutating-methods.slang` dropped the removed `-serial-ir`; render-test device
  cache keyed by global session (`std-lib-serialize.slang.4`). Extracted / ignored / rejected options documented in slang.h.
- Suites: 11154/11157 at R4 (fp8-cuda failures pre-existing); units 674/674 at cd923c72da.

## Lessons from this chain

- **Trace a sibling option's consumer before widening a gate to it.** I told the fixer to gate both "ignored, no targets"
  diagnostics; for profiles that was wrong, because `Linkage::addTarget` overwrites a no-target `-profile`
  (slang-session.cpp:201). A matching diagnostic name does not mean matching semantics.
- **Suppressing particular diagnostics is not an API contract.** The maintainer asked for the purpose split; a gate keyed on
  a mode flag only hid behavior changes.
- **When someone else has commented since, post a fresh delta**, not an in-place edit (the triager rightly overrode my
  instruction). Conversely, two back-to-back bot comments mean the second should have been an edit.
- **An ask that no test can fail is dead code** — my FG006 instruction stopped being reachable once E00045 was session-only.
- A triage "no behavior change" table can miss masked breaks; the fixer's full suite found three.
- **11-03:** pdeayton-nv queued #14111 at 02:22Z. It was evicted at 03:43Z with `failed_checks` because a Windows GPU runner lost its connection (job 125692432093). That is infra, not the PR. The fixer posted a no-mention explanation (cmt 6598550596). Next: a human re-queues it.
- **TERMINAL 11-03 21:05Z:** pdeayton-nv merged #14111 (`f1cd35ff8`) after three infra evictions, and #14103 closed as completed. The fixer cleaned up its worktrees. Follow-up #14195 (slangc E00045) is still open.

**Correction (11-05).** The "no assignee" above was true only when I checked: jkwak-work self-assigned #14195 at 18:47:49Z, 6 min after filing (the `/timeline` actor), and set milestone Q1 2027 at 18:47:59Z. #14111 merged 11-03 21:05Z as f1cd35ff85.

**Operator triage ask (11-05 11:35Z, dashboard msg 34) → read-only verdict from Main; no dispatch, no GitHub post.** A maintainer assignee is a rung-4 hold. An operator ask lifts the hold for the triage answer only, not for bot posts.
- Code read at master 04d2726db0, `slang-options.cpp` ~4985-4996: `reportsAnyTargetOption = !parsesForCompilation(m_purpose)`. So `CompleteCommandLine` (slangc) and `CompileRequest` report only the fp mode (E00045). `hasTargetOptionOtherThanProfile` (:1941) treats any non-`Profile` key as a target option. That is likely why `+` atoms would add E00045 next to E00043 (the FG006 case).
- Verdict: command-line options / diagnostics; enhancement (silent option drop); not a regression; P3; likely `pr: breaking change`.
- Next: held on jkwak-work. A bot draft PR goes out only on their `@nv-slang-bot` mention or an operator go-ahead.
