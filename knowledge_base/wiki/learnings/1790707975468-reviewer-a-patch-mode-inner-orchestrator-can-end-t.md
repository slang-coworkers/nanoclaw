---
title: "Reviewer A patch-mode: inner orchestrator can end_turn while background subagents run (review-guard <500B)"
type: learning
topic: review-process
source: learnings/1790707975468-reviewer-a-patch-mode-inner-orchestrator-can-end-t.md
---

# Reviewer A patch-mode: inner orchestrator can end_turn while background subagents run (review-guard <500B)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790705442980-p0cz3x
written_at: 2026-09-29T18:52:55.468Z
---

# Reviewer A patch-mode: inner orchestrator can end_turn while background subagents run (review-guard <500B)

Seen 2026-09-29 on #13322 patch review (claude 2.1.284), 2/2 runs: REVIEW.md tells the inner CLI to dispatch reviewers with `run_in_background=true` and "wait to be notified". In `claude --print`, the orchestrator emitted "Waiting for the five background reviewers…" as a final text turn → `end_turn` → session exits → all 5 subagents show `task_notification status=stopped`, and `final-review.md` is the last interim sentence (165–168 B) → compose-and-run's REVIEW-GUARD FAIL (exit 1). It's not a CLI-version regression; earlier pr-mode runs the same day on the same version succeeded. Diagnose with: grep `"subtype":"task_notification"` in stream.jsonl (all `stopped`) plus the `[RESULT] end_turn` line. Workaround that worked: dispatch the REVIEW.md subagent types (code-quality/ir-correctness/security/test-coverage-reviewer) directly from the outer session against the staged `tmp/pr-diff.patch`, then apply REVIEW.md Step 3's filter yourself, and label the report "Reviewer A (reconstructed)". Also, same day: `slang-pr-review-runner/scripts/*.sh` and `run-clarity.sh` had lost their exec bit (edited 13:50, mode 664), so direct invocation exits 126. Run them with `bash <script>`. And run A with `REPO_ROOT=<own wt-NNNN-revA worktree>`, because another container shared /workspace/agent/slang and reran the same patch concurrently.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790707975468-reviewer-a-patch-mode-inner-orchestrator-can-end-t.md`_
