---
type: project
name: project_13960_single_call_site_inlining_hlsl_wgsl
description: "HELD 10-27 15:20Z: the reporter opened their own fix PR #13962 (option A, opt-in -inline-single-call-functions). Earlier, 13:43Z, it was parked on a maintainer decision. slang#13960 (albertrodriguezclo, external): feature request for an inlining pass for single-call-site functions on HLSL/WGSL. DXC inlines bottom-up, so each single-call wrapper level adds a copy of the body, and the reporter measures up to 2x DXC time. Triaged: no such inliner or option exists; SPIR-V is already fully inlined by spirv-opt InlineExhaustive. The triager reports (15:21Z [Report]; Main cannot read a peer task) that it rewrote re-check i13960-recheck-072e (11-03T14:00Z, one-shot): it reads #13962 state and reports to Main only, and it posts on GitHub only for an @nv-slang-bot mention."
---

# slang#13960: opt-in single-call-site inlining for HLSL/WGSL

**10-27 13:31:51Z `issue_opened`.** Main webhook session `sess-1793107913861-2t3ida` (the only session on
`gh-issue-shader-slang/slang-13960`). Live read at 13:33Z: open, 0 comments, no assignee, no labels, body not
edited. Human CONTRIBUTOR report, no fix PR, so I dispatched it to slang-triager at 13:33Z.

**Triage (slang-triager, 13:43Z), verified against the posted comment:** feature-request / medium / IR / P2,
not a duplicate (related #13703 from the same reporter, whose community fix was #13709).
- Every inliner in `slang-ir-inline.cpp` runs from a decoration or a target legality rule. None looks at call count
  or size. No CLI option controls inlining (`-O<n>` is passed only downstream).
- SPIR-V output is already fully inlined (`slang-glslang.cpp:422`/`:470`, InlineExhaustive at -O1 and higher).
  HLSL/WGSL keep every wrapper.
- The cost reproduces on Slang's HLSL→DXIL path: depth 0 = 7.1 s, depth 8 = 10.3–10.6 s, and 7.0–7.1 s with `[ForceInline]`.
- Options: **A** (recommended) opt-in CompilerOptionName plus a pass after `performForceInlining`
  (`slang-emit.cpp:2724`); **B** the same pass on by default for HLSL non-lib and WGSL; **C** exhaustive inlining (grows code).

**GitHub artifact:** bot comment issuecomment-6443406312 (13:43:04Z, 12 min after filing). Under current routing the
R6 gate is not live, so expect compliance-check to score this as an R6 FAIL. The comment also asks the reporter whether they will open a PR.

**Parked on:** a Slang maintainer accepting A or B and picking the option name, or the reporter opening a PR.
Timer: the triager's one-shot `i13960-recheck-072e` (session `sess-1793108595139-q8x4sb` on
`system:tasks:i13960-recheck-072e`), 2026-11-03T14:00Z.
**Resume on:** a maintainer or reporter comment, a reporter PR that references #13960, or an operator ask. No fixer
dispatch before a maintainer direction.

Same-author siblings: [#13949](project_13949_peephole_param_self_arg_hang.md), [#13941](project_13941_vswhere_build_tools_products.md).

**10-27 15:20Z `pr_mention` (issuecomment-6445899844, albertrodriguezclo):** "PR: #13962 implements option A (opt-in);
happy to make it the default for WGSL/HLSL if you prefer B." It @-mentions nobody, so it is not a summons. **PR #13962**
(`albertrodriguezclo/slang:feature/inline-single-call-functions`, non-draft, "Fixes #13960", +285/-0, 10 files, reviewer
dshreiner-nv) adds `CompilerOptionName::InlineSingleCallFunctions = 164` and `performSingleCallSiteInlining`. A human
report with the reporter's own open fix PR is held: no fixer dispatch, no bot post, no reaction. The reporter
answered the bot's "will you open a PR?" question, so I closed it on the dashboard thread. I asked slang-triager to rewrite its re-check
so it watches #13962 instead of re-asking. A vs B is now a review decision for the maintainer on #13962.
**Resume on:** an @nv-slang-bot mention on #13960/#13962, #13962 closing unmerged, or an operator ask.
