---
title: "slang-pr-review Reviewer A can exit 0 yet be incomplete (background-subagent orphan)"
type: learning
topic: review-process
source: learnings/1784339218928-slang-pr-review-reviewer-a-can-exit-0-yet-be-incom.md
---

# slang-pr-review Reviewer A can exit 0 yet be incomplete (background-subagent orphan)

**Symptom:** `slang-pr-review-runner compose-and-run` (Reviewer A, the correctness pipeline) returns **exit 0** and writes `final-review.md`, but the file is a tiny (~188-byte) mid-stream fragment like *"Let me examine the AutoDiffSharedContext constructor..."* instead of a synthesized review. The `subagents/` dir is empty and `summarize.py` reports 0/0/0 severity counts.

**Root cause:** The inner `claude --print` (one-shot, `--no-session-persistence`) is model-driven for how it dispatches the six `.claude/agents/*` correctness subagents. Production/REVIEW.md expects **blocking** Task calls. But the model sometimes dispatches them as **background/async** agents and then ends its turn with *"I'll wait for the background agents to complete — the harness notifies me automatically as each finishes."* In one-shot `--print` mode there is **no next turn to wake into**, so the unfinished subagents are orphaned and no final synthesis runs. `repro.sh`'s extractor then grabs the last assistant `text` block — a mid-stream thought — as `final-review.md`. Exit 0 is the CLI's normal termination, NOT proof of a complete review.

**How to detect (don't trust exit 0):**
- `wc -c final-review.md` — a real review is multi-KB with severity markers; <500 bytes = suspect.
- `summarize.py <run_dir>` Per-subagent table: real run shows all ~6 subagents with nonzero tokens/tools. Incomplete run shows only 1 of N with tokens, the rest **0 tokens / 0 tools**.
- Tail `stream.jsonl` for a final assistant text containing *"I'll wait for the background agents"* / *"the harness notifies me"* — that phrasing = orphaned background dispatch, review never synthesized.

**Fix:** Re-run `compose-and-run` (mv the bad run dir to `*-INCOMPLETE` for audit first). A re-run usually dispatches blocking and completes. Diff integrity (`pr-diff.reference` hash) is unaffected, so no head/target concern on re-run. If it recurs, the REVIEW.md/agent prompts may need an explicit "dispatch subagents as blocking Task calls, do not background them" instruction.

**Why it matters:** For an IR-pass/gating change the missing lenses (ir-correctness, security, cross-backend, test-coverage) are exactly the ones that matter; shipping the 1/5 fragment as "Reviewer A" would silently drop the primary correctness pass. Observed on PR #11476 review, 2026-07-18.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784339218928-slang-pr-review-reviewer-a-can-exit-0-yet-be-incom.md`_
