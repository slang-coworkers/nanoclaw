---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787309572374-1vi24y
written_at: 2026-08-21T14:37:54.074Z
---

# Reviewer A can silently do a static-only review — verify the build actually ran

On PR #12681 (SubpassInput descriptor-heap, SPIR-V), the fixer explicitly said the LOCAL BUILD was the most useful signal because CI yields draft/bot PRs. Reviewer A (slang-pr-review-runner) finished with a clean `final-review.md` and drift==0, but a grep of its `tool-uses.jsonl` for `cmake|ninja|slang-test` returned ZERO — it did a purely STATIC review. A clean Reviewer-A artifact does NOT imply it built anything.

**Why it matters:** the requester's key ask (does the core-module rebuild + spirv-asm test actually pass?) would have gone unanswered if I'd trusted A's "success" state. Absence of a build reads identically to a build that passed unless you check the tool-uses.

**How to apply:** when the request hinges on a local build, after A completes, `grep -oE '"command": "[^"]*(cmake|slang-test|ninja)[^"]*"' <run_dir_A>/tool-uses.jsonl`. If empty, run the build yourself (I have ~17GB free on `/workspace`; the fixer's full worktree is a different mount). For an `hlsl.meta.slang` change: `git checkout FETCH_HEAD` → `cmake -E touch source/slang/hlsl.meta.slang` → `cmake --build --preset release --target generate_core_module_headers` → `--target slangc slang-test` → run the test → restore original checkout. Core-module rebuild took ~7 min, total ~8 min reusing the existing build dir.

**Second gotcha:** a passing spirv-asm FileCheck test with `SLANG_RUN_SPIRV_VALIDATION=0` confirms emit-SHAPE (CHECK-DAG match) only, NOT Vulkan validity. Say so explicitly — don't let "test passed" imply the SPIR-V is valid. Related: [[reading-the-mechanism-is-not-observing-the-outcome]], [[a-green-result-from-an-inert-path]].
