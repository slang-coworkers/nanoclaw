---
type: chain
title: slang#14103 — IGlobalSession::parseCommandLineArguments returns SLANG_OK for invalid arguments
description: "Human bug (pdeayton-nv, `bot-ok`): invalid argv still parsed OK. PR #14111 (CommandLineParsePurpose redesign) un-drafted 11-02, R4 APPROVE + capability test @cd923c72da; PARKED on pdeayton-nv's review; slangc follow-up #14195 (jkwak-work, no dispatch)."
tags: [slang, api, command-line]
---

# slang#14103 — parseCommandLineArguments ignores parse errors

`Session::parseCommandLineArguments` (`source/slang/slang-global-session.cpp:1153`) called
`tempReq->processCommandLineArguments` and dropped its `SlangResult`, so `-target` with no value (and any other bad argv)
returned `SLANG_OK`, with the diagnostics sent to a temp sink the caller never sees. Dated history (dispatch → un-draft,
SHAs, comment ids, review inboxes): [[slang/14103-history-triage-to-ready.md]] — **new dated entries append there**, not here.

## Current state (11-02 21:1xZ)

| | |
|---|---|
| Issue | #14103 OPEN, reporter + assignee pdeayton-nv (MEMBER); triage cmt 6533041941 (`reproduced`, Bug, P2); live artifact cmt 6533791303 ("Blocker: None"); thread `gh-issue-shader-slang/slang-14103` |
| PR | **#14111 READY** (un-drafted by pdeayton-nv 11-02 19:21:56Z) @`cd923c72da`, `fix/issue-14103`, `pr: non-breaking`, 11 files +1362/−440; mergeStateStatus BLOCKED (no review) |
| Owner | slang-fixer `sess-1793395338785-cyyd6y` (parent edge = slang-triager; `report_pr_created` mapping) |
| Reviews | R1 REQUEST_CHANGES @8c2926c · R2 APPROVE @27a627a (superseded by the redesign) · R3 REQUEST_CHANGES @4972b71 · **R4 APPROVE @4161c93**; the last commit is test-only (no extra round, by agreement) |
| CI | full run after un-draft: 56 pass / 0 fail / 2 pending at 21:1xZ; CI webhooks route to the fixer |
| Approver | paused → `ready_for_review` queued in `data/approver-pause-queue.md`, not forwarded ([pause note](../pr-approvers-paused.md)) |
| Follow-up | #14195 (slangc: report target options given before several targets with E00045; may be `pr: breaking change`), filed by the fixer at the maintainer's request; jkwak-work self-assigned → a bot fix needs that maintainer's explicit go-ahead. No dispatch |
| Timer | Main one-shot `recheck-14111-ready-af0a`, 2026-11-04T01:15Z (waits on pdeayton-nv's review + CI) |

**PARKED on pdeayton-nv's GitHub review.** No open questions remain. Resumes on a #14111 webhook or the 11-04 one-shot.

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
