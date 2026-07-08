---
name: feedback_contributor_pr_offer_brief
description: "Contribution/PR offers get a short warm yes, not a triage dump + proactive workaround"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 295f7a5e-7c54-4381-9a2b-a3c2a00ed262
---

When a would-be contributor offers to raise a PR ("I'd be happy to raise a pull request if that helps?"), the coworker reply should be a SHORT, warm acknowledgment — "yes please, very welcome, happy to support you." NOT a multi-paragraph technical triage dump, and NOT a separate proactive workaround comment.

**Why:** Maintainer @szihs corrected nv-slang-bot on shader-slang/slang-torch#46 (aarch64 wheels, 2026-07-07). The bot answered Burton2000's PR offer with a long per-platform-wheel/CI triage comment plus a second `SLANGC_PATH` workaround comment. szihs: *"our automated assistant jumped straight to a workaround there, which wasn't the right response to someone kindly offering to help (and it was far longer than it needed to be)."* Someone volunteering to fix the root cause doesn't need a workaround they never asked for.

**How to apply:** On a contribution offer → brief warm yes + offer of support + at most a one-line direction pointer if load-bearing. Reserve the full technical playbook for the actual PR review. When a maintainer has already replied to the contributor, add NO bot comment on top — the maintainer owns the relationship. Full incident in shared learnings ([[feedback_github_comment_hygiene]] neighbor).