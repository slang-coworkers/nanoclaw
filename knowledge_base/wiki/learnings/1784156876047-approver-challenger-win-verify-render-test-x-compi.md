---
title: "[approver/challenger-win] Verify render-test -X<compiler> migrations by the slang-bucket-vs-downstream-bucket distinction"
type: learning
topic: slang-compiler
source: learnings/1784156876047-approver-challenger-win-verify-render-test-x-compi.md
---

# [approver/challenger-win] Verify render-test -X<compiler> migrations by the slang-bucket-vs-downstream-bucket distinction

**Symptom:** PR #12128 migrated ~55 COMPARE_COMPUTE test directives from the tunneled form `-Xslang... -Xdxc <opt> -X.` to the direct form `-Xdxc <opt>` (enabled by the PR making render-test accept all `-X<compiler>` names, like slangc). A mechanical find/replace of "remove the -Xslang... wrapper" would be WRONG in a subtle way.

**Root cause / the trap:** The `-Xslang...` wrapper is used for TWO different kinds of args in test directives: (1) genuine downstream-compiler args (`-Xdxc -Vd`, `-Xnvrtc <flag>`) that SHOULD migrate to the direct form; and (2) SLANG's own args that happen to be tunneled through the wrapper (e.g. `-Xslang... -fvk-use-dx-layout -X.` where `-fvk-use-dx-layout` is a slang/Vulkan-layout option, not a downstream-compiler option). Only (1) may be de-tunneled; (2) must stay as `-Xslang... <opt> -X.` because render-test forwards the "slang" bucket to Slang directly.

**How to catch it (challenger win on #12128):** Sample several migrated files and check that only true downstream `-X<compiler>` args were de-tunneled while slang-bucket args inside `-Xslang...` were left intact. `tests/hlsl/cbuffer-float3-offsets-aligned.slang` was the diagnostic case: its `-Xdxc` line migrated but its `-Xslang... -fvk-use-dx-layout -X.` line was correctly LEFT AS-IS. A correct migration preserves this distinction.

**Why it's failure-loud not failure-silent:** render-test's COMPARE_COMPUTE is a different program from slangc — it rejects unknown flags with a hard SLANG_FAIL and diffs stderr against empty-expected, so a mis-migrated directive fails the lane loudly rather than silently passing. The real false-pass risk the PR itself guards against (Part 2 of the fix) is the opposite: accepting `-Xdxc` but reading only the "slang" bucket would silently drop it — which is why the forwarding in slang-support.cpp `_compileProgramImpl` re-emits non-"slang" buckets into slangc's parser.

**Fix / transferable rule:** When reviewing any render-test `-X` passthrough migration, verify each `-X<name>` token against whether `<name>` is a downstream-compiler (dxc/fxc/glslang/nvrtc/…) or the "slang" bucket, and confirm slang-bucket tunneling was preserved. See prior learning `slang-test-default-compiler-flag-needs-two-forms` and `render-test-compare-compute-is-not-slangc-local-sl`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784156876047-approver-challenger-win-verify-render-test-x-compi.md`_
