---
type: project
name: project_13983_abs_unsigned_spirv_llvm_identity
description: "slang#13983 (nv-slang-bot, filed 10-28 18:15Z by slang-triager from the #13973/#13975 R1 review follow-up): integer abs() emits SAbs on SPIR-V and signed llvm.abs on LLVM for unsigned T, so abs(0xFFFFFFFFu)=1 on vk/llvm. Own fix chain; slang-fixer session tzhs3g on gh-issue-shader-slang/slang-13983 since 18:16Z. Not gated by the #13973 design park."
---

# slang#13983: `abs` of an unsigned integer is not the identity on SPIR-V / LLVM

**Origin.** slang-reviewer's R1 on draft PR #13975 flagged it as a follow-up; the #13973 Main
(`sess-1793201570113-2tdabv`) had slang-triager reproduce and file it. Full parent context:
[project_13973](project_13973_builtin_call_constant_fold.md).

**Report (triager's findings, in the issue body):** vk and llvm return 1 for `abs(0xFFFFFFFFu)`;
cpu/cuda return the input. Emit sites hlsl.meta.slang:8044/:8065 (SAbs), :8047/:8068 (`@llvm.abs(…, i1 true)`).
DXC treats unsigned abs as a no-op; WGSL spec defines it as identity. Suggested fix: return `x` when
`__isUnsignedInt<T>()`. Side finding in the body: no `U16_abs`/`I16_abs`/8-bit abs in the cpu/cuda preludes.

**Ownership.** issue_opened webhook landed 18:15:03Z in Main `sess-1793211306077-r3im67`, which ran the
bot-filed-owner ladder and dispatched nothing: the #13973 Main had already told the triager (18:16:08Z)
to hand off. Triager sent `[Triage handoff]` at 18:16:47Z; **slang-fixer session
`sess-1793211407921-tzhs3g`** is on the canonical thread (verified 18:16:54Z).

**Coordination.** #13975 puts a fold marker on the same integer `abs` overloads; the PRs stay
independent on master and whichever lands second merges master (never rebase a reviewed PR).

**Resume on:** fixer [Fix Report] via the triager → the #13973 Main's chain.

**Side finding filed 10-28 19:40Z as #13989** (prelude 8/16-bit `abs`), together with #13990 (`abs(INT_MIN)` UB),
by slang-triager on the #13973 chain. The #13973 Main (`2tdabv`) holds both as filed-only (no fixer chain,
for fan-out control) until the operator releases them; they are listed in the one-shot `recheck-13975-design-1ff4`
(11-04 14:00Z). The #13989 and #13990 webhook Mains (`e47wxj`, `gbybku`) each ran the owner ladder and dispatched nothing.
