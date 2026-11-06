---
type: chain
title: slang#14359 — serialized module resolves relative dependency from wrong include root
description: Human-filed (ccummingsNV) binary-module reload bug; triaged high/P2, reproduced, handed to slang-fixer on Approach A
resource: raw/triage-14359.md
---

# slang#14359 — binary-module dependency resolves under the wrong include root

- Filed 2026-11-05 20:26:35Z by ccummingsNV. No assignees, labels or comments at 20:27Z. Human-filed, so it was dispatched
  at once under R6. Memory had no prior record (the grep hits for 14359 were only inside a session id).
- Reporter's claim: with `UseUpToDateBinaryModule`, reloading `pkg/base.slang-module` resolves its recorded relative dependency
  `../../build/common.slang` to a byte-identical copy under an earlier search root, not the original file. The consumer then
  lists 5 dependencies, not 4, and `getEntryPointHash` changes. CPU-only reproducer in the issue body.
- Related: [#12789](../supervisor-state.json) (a missing-dependency case in the same loops) is on hold. It was deferred into
  a redesign of how dependency paths are handled (Approach C), and no PR is planned.

## Sessions (thread `gh-issue-shader-slang/slang-14359`)

- Orch: `sess-1793910398603-di2way`. Triage: `sess-1793910485476-66ox46`. Fixer: `sess-1793910917180-7o6asx` (opened 20:35Z by the
  triager's peer handoff).

## State

- 20:28Z dispatched to slang-triager.
- 20:34Z triager report (memo [raw/triage-14359.md](raw/triage-14359.md)). These are the triager's findings; I have not verified them myself:
  bug/high/P2, modules loader. Not a regression: the lookup order dates from #3614 (2024-02). Reproduced at ToT 4a6758601
  with the reporter's program unchanged. **Worse variant:** edit the real dependency after the cold run, and the warm session
  still reuses the stale `.slang-module`. The result is silent wrong code (`baseValue` 7 vs `supportValue` 800).
  Root cause: `isBinaryModuleUpToDate` (slang-session.cpp:2201) and `loadSerializedModuleContents` (:2619) call
  `loadSourceFile(<.slang-module path>, dep)` first. `IncludeSystem::findFile` then searches every search dir, so it finds a
  match before the retry relative to the module source. The freshness check compares digests only (:2226).
  Fix (Approach A): resolve every dependency after the first strictly relative to the recovered module source, through one
  shared helper, with no format change. This is independent of #12789; the PR cross-references #12789 and #9400.
- 20:32Z the installation REST quota (122982130) ran out, fleet-wide; I alerted the dashboard once. The triager is posting
  the issue comment, the `reproduced` label and Type Bug through GraphQL. REST reset ≈21:07Z.
- 20:36Z [Report]: triage comment [issuecomment-6668654767](https://github.com/shader-slang/slang/issues/14359#issuecomment-6668654767)
  posted, with label `reproduced` and Type Bug (via GraphQL). Fixer acked in worktree `wt-slang-14359` on 8cd30de56.
- 22:00Z **draft PR [#14362](https://github.com/shader-slang/slang/pull/14362)** (`fix/issue-14359`, head 9a66461c5,
  "Resolve binary-module dependencies relative to the module source", body closes #14359). I checked that live via REST at 22:0xZ.
  The triager edited its issue comment in place to link the PR.
- 23:34Z [Triage Resolution], as reported by the triager/fixer (I checked live that head = a58f0c061 and the PR is a draft): head a58f0c061, 6 files +451/−95.
  The new `loadSerializedModuleFileDependencies` helper serves both loops. It finds the module's own source from the binary,
  then the search paths, then the cwd, and resolves every later dependency only relative to that source. `slang.h` and the user guide are updated.
  R1 APPROVE_WITH_NITS (nits applied). With the fix, the reporter's repro gives equal hashes and 4/4 deps. Full Linux suite on L40S
  11537/11540 (the 3 fp8-cuda failures also fail on master). CI run 42129805970. Newest issue comment: fixer's
  [issuecomment-6670647469](https://github.com/shader-slang/slang/issues/14359#issuecomment-6670647469).
- **PARKED on maintainer Q1** (shepherd kaizhangNV / tangent-vector), posted in the PR body and the explanation comment
  6670620693: *should the cwd be a lookup root for a binary module's own source?* With the cwd as a root, probe S3b regresses:
  a sourceless precompiled module with an unrelated cwd file at its recorded path becomes stale and fails with E00001.
  Without the cwd, the freshness check is lost for sources recorded by bare file name. Timer: one-shot task
  `recheck-14359-q1-eeb1` at 11-12 23:30Z. Not on the ready-flip list until Q1 is answered.
- Follow-ups found by the reviewer's probe (`/workspace/agent/repro-14359/probe-14362.cpp`). The triager reports both reproduce on master 4a6758601:
  **S1**: with a directory-symlink search root, the dependency is recorded against the lexical path, so a stale binary is reused (S4).
  **S2**: after a freshness check or binary load, the module source's `SourceFile` keeps the reader's lookup path, so a
  recompile resolves relative `#include`s wrongly and fails with E15300 (S6). At the PR head, S7 now catches the stale binary but then hits S2.
  23:3xZ I told the triager to dedupe and file both (filed-only, no fixer chain yet). The dedup search found no duplicates.
  **S2 filed as #14370** at 23:42Z (`reproduced`, Type Bug, standalone repro, includes the #14362 S7 note). It is filed-only: no dispatch is needed for its
  issue_opened webhook (it arrived ~23:43Z; live check: no assignees, label `reproduced`, 0 comments; not dispatched). S1 turned out broader: plain `slangc` simplifies `..` in an `#include` lexically when the file was reached
  through a directory symlink. I asked the triager to check git blame and the docs for intent before filing; if it is deliberate, file it as a behavior question, not a bug. Once review is complete, mark it ready-flip pending
  (weekly list, no per-PR ask).
- 23:45Z **S1 filed as #14371** (medium/P2, `reproduced`, Type Bug). Per the triager, the textual `..` collapse in
  `slang-preprocessor.cpp:3686` (`simplifyPath`, 9b80537bc / #824, 2019) was added only so diagnostics read better, so it is unintended. It
  breaks the `slang.h:1804-1806` contract. It is a general include bug: plain `slangc` compiles the textual sibling, but `-depfile`
  names the physical file. #14370 (S2) is medium/P2. #14371's issue_opened webhook (~23:46Z) was not dispatched (live: no assignees, only bot label/type events).
- **My decision: both are filed-only, with no fixer chains.** #14370 is in the same loader code as #14362, so it waits until #14362 settles,
  which avoids conflicting PRs. #14371 is independent but medium, and the shepherds are carrying a large bot-draft load. The operator can ask for either.
