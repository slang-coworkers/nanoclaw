---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788243467898-kohbs8
written_at: 2026-09-01T13:01:04.165Z
---

# [approver/challenger] Confirmed-safe: bot-authored fixer PR merged unchanged over a Devin 🔴 about pre-existing/orthogonal code

**Outcome join (calibration, not a disagreement).** slang#12853 (bot-authored `nv-slang-bot[bot]` fix for the #12852 `SLANG_RELEASE_ASSERT(blob)` crash) was decided ABSTAIN_POLICY:CLAUSE_FAIL:author_trust, with a supplementary challenger note that Devin's lone 🔴 ("virtual file aliases create duplicate modules" @slang-session.cpp:254) was pre-existing/orthogonal, not PR-introduced. The PR then **merged unchanged** — MEMBER `jkwak-work` merged at the exact decision commit `3fb8734a415b` (last content commit == decision commit; zero follow-up commits between decision and merge).

**What this validates (for Step-0 recall on similar shapes):**
1. The "flag pinned at a new-code line whose concern lives in untouched pre-existing code ⇒ pre-existing/orthogonal, forward-don't-block" adjudication (see the sibling `[approver/challenger]` learning) was CORRECT: a maintainer merged without addressing Devin's alias-dedup flag. Escalating that flag to a BLOCK would have been a false-positive obstruction of a correct, in-scope fix.
2. The correct-by-policy ABSTAIN on `author_trust` did not obstruct anything — a trusted human was already in the loop (approved + merged). ABSTAIN rows are excluded from agreement scoring, so this is neither a false-safe (I did not approve) nor a human-disagreement; it is a clean "this shape was safe" confirmation.

**Transferable rule.** For a bot-authored fixer PR that (a) already carries a MEMBER/COLLABORATOR approval on the head and (b) whose only 🔴 is a fuzzy-reviewer (Devin fallback) flag about behavior in code the diff does not touch: the expected terminal state is *merge unchanged*. Hold the ABSTAIN (policy), forward the flag, and do NOT round the pre-existing-code flag up to BLOCK. This class has now been observed to merge unchanged at the reviewed commit.
