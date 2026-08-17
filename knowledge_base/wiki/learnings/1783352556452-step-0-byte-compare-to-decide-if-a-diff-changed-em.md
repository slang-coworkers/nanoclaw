---
title: "STEP-0 byte-compare to decide if a diff changed emitted output; and codex delivery-gate verdict-parsing format"
type: learning
topic: agent-ops
source: learnings/1783352556452-step-0-byte-compare-to-decide-if-a-diff-changed-em.md
---

# STEP-0 byte-compare to decide if a diff changed emitted output; and codex delivery-gate verdict-parsing format

Two reusable findings from diagnosing shader-slang/slang#11952 (a P3 compile-perf regression bisected to a 1-line change that turned out to change NO serialized bytes).

## STEP-0: "did this diff actually change the emitted/serialized output?"
When a perf/behaviour regression is bisected to a small diff but you suspect the diff doesn't change program OUTPUT (only codegen/layout), prove it cheaply and rigorously:
1. Build the culprit binary with a stderr marker inside the EXACT changed branch. Run the real fixture. If the branch never fires, the two versions return identical values by construction (a flag-INDEPENDENT proof — LTO/opt level can't change which branch executes for given inputs).
2. For a literal byte-compare: revert ONLY the diff and do an INCREMENTAL relink (recompiles just that one .o). The build-tag/version object is then SHARED between the two binaries → the `cmp`/sha256 of the outputs is free of build-metadata confounds. This is cheaper AND cleaner than building two historical commits (no submodule churn, no inter-commit noise, isolates exactly the diff).
3. A DEBUG-build byte-compare is valid evidence for an LTO-RELEASE output question, because serialized/emitted output is deterministic w.r.t. optimization flags — but state that caveat honestly and lead with the branch-unreachable argument as the real proof.
Corollary: if the output is byte-identical, a "regression" bisected to that diff under LTO is almost always a code-LAYOUT artifact (function reordering/inlining/alignment shifting unrelated hot code) — not fixable by a targeted source change. Honest outcome = re-baseline, not chase a phantom fix. Don't implement an "optimize the load/hot path" fix if that path is textually unchanged by the diff (it'd trim pre-existing cost, not recover the delta).

## codex-critique delivery-gate: how the verdict actually gets recorded
The critique-gate (on `/slang-fix-issue` etc.) blocks delivery/handoff (`send_message` [Fix Report], `gh pr create`) until PLAN_REVIEW+CODE_REVIEW+OUTPUT_REVIEW each have ≥1 recorded round AND OUTPUT_REVIEW's latest verdict = approve. The PARSER:
- Records the STAGE only from a FRESH `mcp__codex__codex` call whose prompt contains a `STAGE: <X>` line.
- Records the VERDICT only when codex returns the skill's EXACT block `### Verdict\napprove` (or `must-fix`). "VERDICT: approve" as free text is NOT parsed (shows "verdicts: none"). Pass `developer-instructions` = the codex-critique skill's reviewer template so codex emits that structure.
- A `mcp__codex__codex-reply` (round 2/3 of a must-fix) approve is NOT attributed to the stage — the reply carries no STAGE tag. So to clear a must-fix'd OUTPUT_REVIEW you must fix, then issue a NEW STAGE-tagged `mcp__codex__codex` call, not a reply.
The gate FIRES EVEN FOR A NO-CODE DIAGNOSIS delivery. For a "no source fix" outcome, CODE_REVIEW is still meaningful: it's the scope-shrinkage guard — ask codex whether concluding "no fix" is evidence-backed or under-delivery (with `git diff base..HEAD` empty as the artifact). All codex calls in this container require `sandbox: "danger-full-access"` (a hook rejects read-only).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783352556452-step-0-byte-compare-to-decide-if-a-diff-changed-em.md`_
