---
type: chain
title: slang#9643 — overlapping push-constant ranges across vertex/fragment entry points (SPIR-V)
description: Human-filed (petar-andrejic) 2026-01-16. Maintainers (jkwak-work, tangent-vector) ruled it a real design problem 02-27, schedule "Unplanned"; juliusikkala proposed allowing [vk::offset(N)] on EP params 08-13. Triaged 10-30 (cmt 6531861693, label `reproduced`, P3 enhancement); jkwak-work picked A (vk::offset on EP params) 20:09Z → slang-fixer dispatched.
resource: https://github.com/shader-slang/slang/issues/9643
---

# slang#9643 — overlapping push-constant ranges

- Each entry point's `uniform` params lower to its own `EntryPointParams_c` PushConstant block at Offset 0,
  so vertex + fragment ranges alias in one pipeline. Workaround: global ParameterBlock push constants.
- Maintainer state: real design gap (compute-centric model; slangc sees arbitrary EP mixes) — tangent-vector
  02-27; interim proposal `[vk::offset(N)]` on EP params (juliusikkala 08-13, slang-check-modifier.cpp gate).
- Related, **not a dup** (slang-triager, 10-16): [slangpy#1232](slangpy-1232-vulkan-module-push-constant.md)
  / slang#13713 / #13724 (global + EP blocks in ONE entry point).
- 2026-10-30 19:18Z: jkwak-work "@nv-slang-bot can you triage?" (cmt 6531543331). No labels; R6 long expired;
  post authorized. Dispatched slang-triager on `gh-issue-shader-slang/slang-9643`. No prior coworker chain.
- 10-30 19:23Z (slang-triager reports, unverified): reproduced on ToT — both `EntryPointParams_c` blocks at Offset 0; `[vk::offset]` on an EP param still errors E31002. Final report pending.
- 10-30 19:24Z (slang-triager reports, unverified): ToT workaround — one `[vk::push_constant]` global per stage with `[vk::offset]` fields (spirv-val clean); reflection ignores `[vk::offset]` (reports 0, SPIR-V says 8) — bears on juliusikkala option. Final report pending.
- **10-30 19:35Z TRIAGED + PARKED.** Verified on GitHub: comment 6531861693 by nv-slang-bot, label `reproduced`. Options put to
  jkwak-work (+tangent-vector): A `[vk::offset]` on EP uniform params (gate slang-check-modifier.cpp:1541-1544; scratch build works
  for SPIR-V/GLSL, reflection still 0), B per-EP base offset, C composition design, D document workaround. A/B/D → fixer.
  Triager's re-check t-136ee4 11-06 (in triager's group — not visible to my `ncl tasks`). Memo copy: /workspace/inbox/a2a-1793388966991-zxmn2y/triage-9643.md.
- Side finding (triager, mentioned in the comment): reflection ignores `[vk::offset]` on any struct field (SPIR-V 8, reflection 0); no
  issue filed — my ruling: don't file; the maintainer's reply decides. Untested slang-rhi hypothesis (per-EP ranges consecutive vs Slang Offset 0) — same family as slang-rhi#915.
- 10-30 19:37Z: triager deleted /tmp/slang-9643src after saving the option-A diff (one line, slang-check-modifier.cpp:1543 `|| as<ParamDecl>(targetDecl)`) to its memory/issues/triage-9643.md. Idle until a maintainer reply or t-136ee4.
- **10-30 20:09Z jkwak-work picked option A** (cmt 6532465465): "make a PR for making `[vk::offset]` to work; for now". Mused (NOT asked,
  "will discuss in a meeting") that implicit push-constant for EP uniforms should be compute-only / maybe warn for non-compute.
  Reflection-honors-vk::offset scope NOT stated by maintainer → fixer to state scope in PR and ask if it leaves reflection out.
  Dispatched slang-fixer (fresh, branch fix/issue-9643, thread gh-issue-shader-slang/slang-9643); told triager the chain moved.
- 10-30 20:10Z: triager cancelled t-136ee4; it waits for the fixer [Fix Report] relayed by me, then sends [Triage Resolution]. → When the fixer reports, forward it to slang-triager on gh-issue-shader-slang/slang-9643.
- 10-30 20:43Z (slang-fixer reports, unverified): local fix = gate widened to params + varying-param error E31166 + reflection honours vk::offset on Khronos targets; L40S Vulkan reads 3/5/7 with fix vs 3/0/0 without reflection change. Regression suite → CODE_REVIEW → draft PR next.
- 10-30 21:55Z: **draft PR #14108** (head efce7d1, `pr: non-breaking`, +231/-4, 11 files; pr-mapping → slang-fixer sess-1793390998700-klhj49). Adds E31166 (varying param) + E31167 (out-of-range offset), reflection honours vk::offset on SPIR-V/GLSL, Vulkan-only IR-layout gate. **Open Q for maintainer (blocks merge): IR gate also returns struct-field `[vk::offset]` to natural offsets off Vulkan (WGSL/CUDA behaviour change) — keep or params-only?** Explanation HTML: /workspace/inbox/a2a-1793397523441-keei7u/. Awaiting fixer 5-bullet.
- 10-30 21:59Z fixer [Report] (verified on GitHub: issue status cmt 6534333208; CI run 41134516673 `waiting` on efce7d1; explanation cmt 6534326863).
  Scope grew on evidence: reflection fix in ScopeLayoutBuilder; Khronos-only IR vk::offset (LLVM crash / WGSL misalign without); E31166/E31167; reflection extent.
  Two merge-blocking Qs to jkwak-work: (1) keep the IR gate (it also moves struct-field vk::offset back off Vulkan, e.g. HLSL ByteAddressBuffer.Load<S>) or params-only; (2) struct-field reflection here or as a follow-up.
  Fixer sent [Fix Review Request] to slang-reviewer directly. The triager waits for [Fix Report] (not this interim). My re-check **recheck-slang-9643-pr141-cb9b** at 11-04 22:00Z.
- 10-30 22:43Z slang-reviewer R1 @efce7d1: **APPROVE_WITH_NITS** (0 bugs). G1 = no test pins the off-Vulkan struct-field change; G2 = no front-end diagnostic for a misaligned/overlapping N (E99999 under validation). Remedy patch (+122/−2: test + E31168/E31169) sent **directly to the fixer** (fixer inbox seq 18/20); I got a copy at /workspace/inbox/a2a-1793400190965-32nnzn/combined-review.md.
  Reviewer's answer to Q1: keep the IR gate (master is already inconsistent off Vulkan: BAB `Load<S>` reads b@16 while CB/SB read b@4; Khronos output is byte-identical master→head; sizeof unchanged). Q2: follow-up, and the docs should limit the reflection guarantee to top-level EP params. Full suite 11123/11126 (3 fp8-cuda also fail on master).
  **Side find S1 (pre-existing):** an existential EP param reflects at offset 12 but SPIR-V puts it at 16 (umbrella #12316) → routed to slang-triager for dedup/repro; filing is held until jkwak-work answers Q2, so the reflection-vs-IR-layout follow-ups are filed together.
- 10-30 22:44Z reviewer [Review Verdict] R1: APPROVE_WITH_NITS, sent to me + fixer, **not posted on GitHub** (not authorized). My ruling: no separate review post; the fixer puts the R1 outcome and the reviewer Q1 evidence in its next PR update.
- 10-30 22:48Z triager S1 dedup (memo on triager FS memory/issues/triage-14108-sidefind-s1.md, repro /workspace/agent/repro-14108-s1/): **reproduces on master e638298fe, not a dup**. It is a new instance of the #12316 drift class.
  Two drifts: (1) alignment: the front end (slang-type-layout.cpp:6076-6115) sets none (JSON reports 1), while IR lowers to Tuple(uint2,uint2,AnyValueN) with alignment 8 (std430/Metal) or 16 (WGSL); (2) size: the front end always reserves a 16-byte AnyValue ("ABI contract"), while IR infers the size from conformances (slang-ir-any-value-inference.cpp:458-461) — a design call.
  WGSL disagrees too; CUDA rejects (E50104). Siblings: #12384, #13533 (open), #13704 (closed); #10892 = the related typeflow crash.
  **Triager rec (my decision, held until jkwak-work answers Q2):** file S1 and the struct-field vk::offset gap as 2 separate Bug issues, plus 1 roll-up comment on #12316 listing every instance. If Q2 = "fix in #14108", file only S1 + the #12316 comment. Nothing filed yet.
- 10-30 23:09Z: the fixer pushed R1 fixes, PR head **f72fbf2**; explanation HTML at /workspace/inbox/a2a-1793401789709-iq23xo/. Awaiting [Fix Report].
- 10-30 23:10Z fixer **[Fix Report]**, verified: head f72fbf2cf, still draft, `pr: non-breaking`; R1 outcome posted on the PR (cmt 6535430528); CI run 41141439786 `waiting` (wait-for-human-priority). Added E31168/E31169, the off-Vulkan pin test, and the shared predicate `doesTargetHonorVkOffset`. 23 vk-offset variants pass on the L40S.
  **Parked on jkwak-work Q1/Q2.** I forwarded the Fix Report to the triager and told the operator about the held S1 filing plan. Human step: "Ready for review" (draft).
- 10-30 23:11Z triager [Triage Resolution]: its triage chain is closed; nothing posted (issue status cmt 6534333208 is still current). S1 filing waits on Q2. I dispatch it to the triager then (re-check cb9b).
