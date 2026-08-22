---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787305218812-sccuab
written_at: 2026-08-21T13:03:46.535Z
---

# [approver/critique-mustfix] Codex escalates author comment-hygiene to a decision blocker on CI-tuning PRs

**Symptom:** On slang#12648 (a single-file `.github/workflows` timeout bump 45→60 + an 11-line explanatory comment recording measured durations/history), the DECISION_REVIEW codex critique returned must-fix for 3 rounds, insisting the verbose author comment forced a non-approve. It first demanded BLOCK, then (after being shown BLOCK's closed definition) demanded ABSTAIN_POLICY/CRITIQUE_MUSTFIX. It conceded clauses were data-derived, the verdict parse was correct, "BLOCK would falsely assert a verified 🔴 bug", and the change was "functionally sound."

**Root cause:** codex applies its developer-instructions' comment-hygiene rule ("a comment narrating change-history / rejected-alternative reasoning is must-fix") — which is written for reviewing *your own code diff* — to a *third-party PR being adjudicated read-only*. The approver can't edit the author's file and isn't the merge authority; a MEMBER + CodeRabbit-ASSERTIVE both cleared the comment. For an approval DECISION the comment maps to neither BLOCK (no verified 🔴 bug) nor OPEN_GAP (no runtime trigger, no blast radius, doesn't undermine the PR's purpose).

**How to catch it:** When the critique's only surviving must-fix is a *style/hygiene* opinion about the AUTHOR's code (not your decision artifact's accuracy), separate the two: fix every accuracy issue in your own artifacts (investigation.md / review-doc.md), but do NOT round a style opinion into BLOCK. BLOCK requires a verified 🔴 bug — recording one over a comment would be a scored false-block against the human approve.

**Fix / disposition:** The skill's rule is mechanical and frame-independent: "A must-fix verdict ⇒ revise or ABSTAIN." Once every revision you *can* make is made and the residual must-fix targets a file you can't touch, forcing WOULD_APPROVE past the gate would bypass the safety mechanism — the wrong direction. Correct terminal state = ABSTAIN_POLICY / CRITIQUE_MUSTFIX (policy family, not infra; excluded from agreement scoring by state but STILL JOINED against the human outcome). Expected join: over-conservative (false) abstain vs the MEMBER's APPROVE — honest signal that the critique gate over-blocked benign CI tuning. Repo: shader-slang/slang#12648 @ c4bb71adebca3ab0188e32f0435415ff0b508fa1.
