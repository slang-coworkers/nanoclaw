---
type: chain
title: slang#14027 — standard module of portable parallel primitives (block/device scan, reduce, sort, compaction)
description: Human-filed (albertrodriguezclo) feature/design proposal 2026-10-29 16:18Z, part of the reporter's cloth-sim batch #14026–#14031. Triaged feature/low/P3 by slang-triager; bot comment posted 16:52Z (unlike sibling #14029, held under R6). CLOSED 11-02 (reporter goes package-first; stand-down posted). The R6 "miss" was moot: merged R6 has no wait.
tags: [standard-modules, memory-model, feature-request, closed]
---

# slang#14027 — parallel-primitives standard module

**Ask.** A standard module (like `neural`/`numerics`) with `BlockReduce`/`BlockScan`/`BlockRadixRank` and
`DeviceReduce`/`DeviceScan`/`DeviceSegmentedReduce`/`DeviceRadixSort`/`DeviceSelect`/`DeviceRunLengthEncode`.
Constraints: deterministic reductions, a multi-pass fallback that does not depend on forward progress,
5 backends, and a slang-rhi/SlangPy host helper. Prior art: Discussion #4366.

**Triage (slang-triager, 10-29 16:53Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
The gap is real. The block level needs no compiler feature; it compiles (compile-only) on SPIR-V/CUDA/Metal/HLSL/WGSL.
Single-pass decoupled look-back is not portable today:
- `Atomic<T>` MemoryOrder is dropped on HLSL/CUDA/GLSL, and WGSL atomics are relaxed.
- `globallycoherent` is dropped on Metal/CUDA.
- `loadCoherent`/`storeCoherent` exist on SPIR-V only (#3870).
- Metal has the #14010 problem.

The triager recommends (C): ship the block level plus a multi-pass device level first, then add single-pass per target as the gaps close.
Maintainer questions: placement (in-tree vs separate repo), staging, separate memory-model issues, and where the host helper lives.

**GitHub state (verified 10-29).** Type=Feature (set by the bot); no labels; 1 comment, nv-slang-bot 6502945982 at 16:52Z.
⚠️ **The R6 handling differs from the sibling issue.** #14029 (also Feature, same batch) was held at 0 comments under R6's 4-day wait. #14027 was posted at once.
I flagged this to the operator. At 16:56Z the triager confirmed it was an inconsistency: R6 is not in triage step 9
("Always post"), and recall did not surface it. **#14020 has the same miss**, which I verified: opened 14:32:34Z, bot comment
6499706139 at 14:39:55Z, a fence but no crash word. My own dispatch did not state an R6 hold either. Waiting on the operator:
(1) leave, hide or delete the comments on #14020 and #14027; (2) the durable fix of adding R6 to triage step 9 (nanoclaw spine).
A shared learning was filed on 10-29.

**10-29 17:18Z: maintainer engaged.** jkwak-work (MEMBER) assigned himself and commented (6503521729):
"This is an exciting proposal. I will follow up the progress." There is no @nv-slang-bot mention and no answer to the
4 questions. I relayed it to the triager with a hold: no bot post.

**10-29 17:41Z: tangent-vector (MEMBER) gave design input (6504022674); no bot mention, no ask of the bot.**
- Placement: they prefer an out-of-repo package, since jhelferty-nv is building a Slang package manager. They also accept a standalone
  shader-slang org project or an in-repo standard module, and will not gate progress on the package route.
- Performance portability is the key open problem: `__target_switch` per target, plus per-architecture/device specialization.

That partly answers the placement question. Staging, the memory-model issues and the host helper are still open. I relayed it
verbatim to the triager, with the no-post hold still on.

**11-01 14:38Z: the reporter is going package-first (6559409128).** albertrodriguezclo will build a standalone package outside
the compiler repo. The v0 scope is scan, reduce, segmented reduce, compaction, radix sort and a block histogram. The API is
buffer-based, so WGSL works. The design uses `__target_switch`, link-time constants and a reduce-then-scan fallback.
Two questions go to the maintainers: (1) a naming and versioning convention; (2) API conventions for scratch memory and
temp-size queries. The bot is asked nothing, so no bot work follows. I relayed it verbatim to the triager, with the hold still on.
Operator Decisions 1 and 2 (R6) are still unanswered as of 11-01; I found nothing in the last 200 dashboard rows.

**11-01 14:41Z: STOOD DOWN (triager).** Placement is settled (package-first), and the reporter owns the work. The triager says it
cancelled `t-a4ca33`; I could not check that, since `ncl tasks` from Main can't see a peer's tasks. I lifted my no-post hold for one
stand-down 5-bullet after the R6 window ends (11-02 16:18Z), skipped if the operator rules "delete" first.
I sent the two unfiled triage gaps (`Atomic<T>` MemoryOrder dropped on HLSL/CUDA/GLSL; `globallycoherent` dropped on
Metal/CUDA) to the triager under the 10-31 filing rule: dedupe against #3870 and #14010/#14011, then file only if it is a bug
reproduced on master, without naming #14027 before the window ends.

**11-01 15:05Z: gap follow-ups (triager; master 6815ed82d, L40S).** I checked each on GitHub.
- `Atomic<T>` MemoryOrder → covered by **#10683** (skiminki-nv, assigned, already reproduced by the bot 04-10). The triager's runtime
  evidence: a CUDA acquire spin hangs, and vk via GLSL loses the device. I chose **not** to post it on #10683, because the thread is
  human-owned, the bot has already reproduced there, and skiminki answered jhelferty's question on 04-02. The evidence stays in the triager's memo.
- `globallycoherent` Metal → covered by **#14010**.
- `globallycoherent` CUDA → **filed #14140** (Type=Bug, `reproduced`, no @-mentions, no #14027). Filed only; no fixer without asking me.
- WGSL `globallycoherent` silent drop → a feature gap, reported and not filed.
- Stand-down post: the triager's one-shot **t-cc056c**, 11-02 16:30Z. It skips if 6502945982 is gone or a ruling is recorded.
  Pass any operator ruling to the triager on the thread.

**11-02 16:33Z: CLOSED.** The triager's `t-cc056c` posted the stand-down (6582500256, which I checked). No bot action is left.

**11-02: jkwak-work answered the reporter's naming/versioning question (6584210815):** "we don't have strong convention yet", and
conventions will emerge as more modules are built. No bot ask, so it went to the triager to record; no post.

**11-03: reporter ack (6611446504).** They asked on #14020 for a package-manager version or layout, and will reuse it here. No bot ask; relayed to the triager to record.

⛔ **The R6 thread in this record was my error.** The merged R6 (nanoclaw #1993 + #2165, 10-25) has no wait. So the immediate
comments on #14020 and #14027 were correct, Decisions 1 and 2 were moot (withdrawn 11-02), and the "miss" the triager
admitted was not a miss. I marked my 10-29 shared learning SUPERSEDED and asked the triager to delete its step-9 R6 note.
See [imported/project_13591_ai_contributor_standards_batch.md](../imported/project_13591_ai_contributor_standards_batch.md).

Owner: slang-triager, thread `gh-issue-shader-slang/slang-14027`. Memo: `/workspace/inbox/a2a-1793292830884-nykabg/triage-14027.md`.
