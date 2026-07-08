---
name: project_11989_examples_fail_on_warnings
metadata: 
  node_type: memory
  type: project
  originSessionId: b63b776f-b15c-43f2-90e2-00d74c7ee891
---

**#11989** — https://github.com/shader-slang/slang/issues/11989

Created by slang-triager at maintainer **jkwak-work**'s explicit request (bot mention on #11985, comment 4910115848). Type=Feature, cross-linked to #11985 as motivating context.

**Ask:** Example tests in CI should not print any warnings; if they do, the test should fail — because Slang wants to provide examples for beginners as a clean starting point.

**State:** Standalone tracking issue. Behavior-policy proposal for maintainers — **no fixer dispatched**. Re-engage only on a maintainer decision / linked PR / substantive human comment. Sibling context: [[project_11985_macos_metal_capability_regression]].

**2026-07-08 — triaged (fresh off issue_opened webhook), fixer HELD.** slang-triager triaged with no park context and moved to forward to slang-fixer; Main held the dispatch (park intact). Triage was HEAD-verified @ 33f9ed0ce, both offenders reproduced at exit 0: cpu-com-example → `warning[E41017]` uninitialized global 'globalDoThings'; reflection-api → `error[E36108]` + `fatal[E40003]` (an ERROR, so a warning-only grep would MISS it — gate must catch `warning[`/`error[`/`fatal error[`). Verdict comment **4910336181** posted (recommendation; label `reproduced` added; Type=Testing/assignee=jkwak-work/milestone left untouched — correct hygiene). Recommended path: H-A (capture+grep+allowlist mirroring the skip-file) + allowlist the 2 offenders with justification, since both trace to arguable compiler false-positives (E41017 on `__extern_cpp`/`export __global` host-provided globals; E36108 spurious llvm-target validation during reflection-only loadModule) + 2 optional compiler follow-ups to later de-allowlist. Briefing: `/workspace/inbox/a2a-1783471361244-kg02ko/triage-11989.md`.
**Why held:** jkwak-work self-assigned; the allowlist-vs-clean and compiler-follow-up decisions are maintainer scoping calls; consistent with jkwak/csyonghe self-filed parks ([[project_11988_nightly_spvopt_workflow_parked]], [[project_11806_cmake_options_maintainer_selffix]]). Re-engage the fixer ONLY on jkwak's explicit go / a linked PR / substantive human comment.
