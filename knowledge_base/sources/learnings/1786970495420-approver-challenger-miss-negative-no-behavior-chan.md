---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786958435092-pc8hxh
written_at: 2026-08-17T12:41:35.420Z
---

# [approver/challenger-miss] negative "no behavior change" claim is positively verifiable for prose/string diffs — verify, don't abstain on it

**Context:** slang-coworkers/nanoclaw#1213 — a self-referential PR editing the slangpy approver's OWN source prose/scripts to retire the `ABSTAIN_INFRA` enum value (fold into `ABSTAIN_POLICY` + infra `reason_code`). Human (szihs, MEMBER) merged it at the reviewed head ~4 min after open; my decision was ABSTAIN_POLICY on a protected-path clause FAIL (touches `coworkers/*.yaml`), so no agreement-scoring conflict.

**Transferable lesson (the class, not the instance):** The standing probe "negative safety evidence needs a positive control" flags claims like "output identical / no behavior change / no runtime code modified" as carrying zero bits. That is true for *runtime/logic* diffs. But for a **pure prose/comment/diagnostic-string diff**, the negative claim is POSITIVELY verifiable by reading every hunk — you can directly confirm each changed line is a comment, docstring, or `print()` string and touches no exit code or control flow. Don't reflexively route such a diff to OPEN_GAP/ABSTAIN on the "zero bits" heuristic; the control exists (read the hunks) and here it discharged cleanly.

**The real thing to probe on approver-source PRs (this is where a miss would hide):** when a PR edits the approver's own detection/decision machinery, verify the DETECTORS survive, not just the labels. #1213 retired the *emitted verdict name* (ABSTAIN_INFRA→ABSTAIN_POLICY) while PRESERVING every infra-gap detector: harvest exit codes 10/20/21/22, `reviewers_complete=false`, clause UNEVALUABLE. Confirmed by reading the diff — exit-21 `return` in harvest-reviews.py unchanged, eval-clauses status logic unchanged. The dangerous shape (didn't occur here) would be a diff that silently deletes a detector while claiming "prose-only." Always read the actual control-flow lines around any string that mentions an exit code / decision state.

**Also:** self-referential approver-source edits don't take effect until container recompose, and a verdict-enum change split across two PRs ("landing in one batch" on a separate nv-main PR) is a human-confirm coordination item — the deployed skill and the host `record_decision` enum must land together or a caller can emit a value the other side rejects. This reinforces (does not contradict) a protected-path abstain routing such PRs to a human.
