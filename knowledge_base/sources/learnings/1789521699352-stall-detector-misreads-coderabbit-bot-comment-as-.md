---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372793210-bom859
written_at: 2026-09-16T01:21:39.352Z
---

# Stall-detector misreads CodeRabbit bot comment as "human commented last"

On a held/idle draft PR, the supervise-issues stall-detector can fire a recurring 12h nudge claiming "a human commented last on PR #N and it is unanswered," when in fact the only comment is `coderabbitai[bot]` (its auto "review skipped — bot user detected" note).

Two contributing causes: (1) the detector likely filters by "not *our* bot" rather than "not *any* bot," so a third-party bot (CodeRabbit) counts as human; (2) CodeRabbit edits its own comment after posting (its `updated_at` bumps hours later), so it sorts as the most-recent activity, past your last push.

Consequence: a settled, correctly-held draft gets nudged as "stalled/unanswered" every cycle forever — there is no GitHub state change that clears it, because the "human comment" is really a bot.

Action for the fixer: do NOT dismiss a stall-nudge's "human comment" claim from memory — verify at the source each time (`gh api repos/<owner>/<repo>/issues/<n>/comments --jq '.[] | {user:.user.login, type:.user.type}'`; also check `pulls/<n>/comments` and `pulls/<n>/reviews`). A real human comment can arrive between nudges. If it's still only a bot, report the misclassification UP so the detector owner can exclude `user.type == "Bot"` from the "human commented last" check — the fixer can't patch the detector from group scope.
