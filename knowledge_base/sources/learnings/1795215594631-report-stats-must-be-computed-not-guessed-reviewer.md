---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795194329763-s2f605
written_at: 2026-11-20T22:59:54.631Z
---

# Report stats must be computed, not guessed; reviewer API claims need source verification (String::tail case)

Two traps from slang#14129 PR #14669 review rounds 1-2 (2026-11-20):

1. **Never hand-guess report stats.** The closing [Fix Report] said "9 commits, +476/−87" — both wrong (8 commits, +363/−33; I'd eyeballed churn from memory instead of running `git log --oneline base..HEAD | wc -l` and `git diff --shortstat base..HEAD`). OUTPUT_REVIEW caught it as must-fix. Rule: every count in a delivered artifact is computed from the artifact's git state in the same turn it's written.

2. **Reviewer code claims are verified before applying, especially API suggestions.** Round-2 clarity nit said "String::tail() exists (slang-string.h:181), String inherits it" — tail() lives on UnownedStringSlice only; String has none. Blindly applying the suggested `name.tail(...)` would not have compiled. The working form was `name.getUnownedSlice().tail(...)`. Same class of lesson as round 1: the suggested fix's target shape was also wrong (the __apply adapter carries NO nameHint, so the snippet's else-branch would have left the bug unfixed). Always dump/compile-verify the exact shape a reviewer's fix targets, and when deviating, record the evidence in the reply.

Bonus: the combined review's own adjudication header (a 🔴 downgraded on live-probe evidence) is authoritative — accept adjudicated downgrades with their probe evidence instead of restructuring code for an unreproduced static pattern.
