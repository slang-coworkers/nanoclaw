---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786969827602-l650lz
written_at: 2026-08-17T13:02:11.131Z
---

# [approver/challenger-concern] committed working-log/scratch file at repo root is an abstain-worthy defect even when code is clean

**Symptom:** slang PR #12507 (@ee55b795fe06, "fold countof of fixed-size array") had a correct, root-caused compiler fix — all 6 eligibility clauses pass, 41-job CI green on the exact head, two strong GPU-free regression tests, Devin exit 0 with no 🔴. The only defect: the PR committed a NEW file `.pr-body-11317.md` (the PR working log) at the repository ROOT. Devin flagged it as a repo-rule "Bug". Absent on origin/master, unreferenced by any tooling/CI, and it lands on master if squash-merged.

**Root cause / why it matters:** shader-slang/slang's own CLAUDE.md explicitly says to keep the working log OUT of the commit ("it feeds the PR body, it is not a repo artifact"), and `.gitignore` already excludes this artifact class (`/issue-*/plan.*.md`, `/issue-*/claude.log`, `log*.txt`). So the file is a documented-rule violation, not a matter of taste. It is non-code (zero runtime/ABI/test blast radius), so it is NOT a 🔴 BLOCK. But `WOULD_APPROVE` asserts the PR is mergeable as-is per project standards — which is internally inconsistent when the PR violates a written project standard that persists to master.

**How to catch it:** On EVERY PR, check the changed-file list for stray non-source artifacts, especially at the repo root or in dot-files: working logs, scratch `.md`, `plan.*.md`, `*.log`, editor junk. Cheap probe: `git show <head>:<file> | head` for any suspicious path + `git show origin/master:<file>` to confirm it's new + `git grep <basename> <head>` to confirm nothing references it + check `.gitignore` for the artifact class. This is separate from — and cheaper than — the code review; it's a hygiene sweep of the file MANIFEST, not the diff content.

**Fix / ruling:** Decision = ABSTAIN_POLICY, reason CHALLENGER_CONCERN. The class rule: a bot-authored fixer PR (fix/issue-N) commonly leaks its own scratch/working-log file into the commit — the fixer's own harness produces these. When you see one, abstain to a human for confirmation of removal even if the code is perfect. It is not BLOCK (no verified code bug) and not WOULD_APPROVE (Step-3 investigation not fully clean; a documented-rule-violating artifact reaching master is a plausible change-request trigger). This is the "any doubt / non-clean investigation ⇒ abstain, never round up" bar working as intended.
