Daily review-cycle mining for slang-coworkers-prod. The gate found PRs whose human review took unusually many rounds and that nobody has explained yet. Follow the /review-cycle-mining skill (mirrored at /home/node/.claude/skills/review-cycle-mining/SKILL.md) exactly; this prompt only fixes the run's shape.

GATE DATA. The scheduler attached the gate's payload to this prompt. Two forms:
- `error` set (missing helper, snapshot missing/stale/old shape, corrupt why file): do NOT mine. Post exactly one line to this task's chat destination: "review-cycle-mining: gate error: <error>" and stop. Repeating that line every day until an operator fixes the pipeline is the intended behaviour; never work around it by selecting PRs yourself.
- `batch` set: the PRs to mine this run (at most 10, most rounds first), `candidates` = how many qualify in total, `alreadyMined` = records already in the why file.

RUN (skill steps 0 to 4, all read-only on GitHub):
0. `python3 /workspace/shared/.mine_select.py select > /tmp/rcm/batch.json` (mkdir -p /tmp/rcm first). Use ITS batch, not the gate's summary, so the rows carry `classification`, `longestComments`, `activityWeeks`, `reviewers`, `removed`, `truncated`.
1. Per PR: `gh pr view` + `gh api --paginate` for inline comments, conversation comments and the timeline, redirected to /tmp/rcm/. Apply the snapshot's `filters` block (bot logins, patterns, board-sync markers, dispatch commands, the PR author) before reading, so you explain the same population the chart counts. Read in time order; cap ~150 comments per PR (sample as the skill says and disclose it in whyLong).
2. Categories from the nine allowed values only, one to three, evidence-backed: understanding, design_disagreement, scope_creep, ci_flakiness, style_nits, missing_tests, slow_reviewer, author_churn, automation_noise.
3. One record per PR into /tmp/rcm/new.json: repo, number, url, rounds, comments (copied from the row), whyShort (<= 240 chars, one line, mechanism first), whyLong (<= 1200, time order, process not people), categories, quotes (<= 3, verbatim, <= 160 chars, real createdAt, never a filtered automation comment), suggestedRule (one sentence <= 300 the team could adopt). Then `python3 /workspace/shared/.mine_select.py merge --new /tmp/rcm/new.json`. A refusal names the field and the cap; fix and re-run. Never edit review-cycles-why.json by hand.
4. Report ONE line on this task's chat destination (ncl destinations list):
   "review-cycle-mining: mined <k>/<candidates> (<repo>#<n> r<rounds>/c<comments> <cat>+<cat>; ...); <left> left for tomorrow; why-file <count> records"
   Nothing else: no PR, no git, no GitHub comment or review, no second message.

BOUNDS. Whole batch or stop cleanly: a PR you could not finish stays unmined and comes back tomorrow; never merge a half-read record. Redirect every gh output to a file and read tails; do not page comment dumps into the transcript. Write nothing outside /workspace/shared/reports/review-cycles-why.json and /tmp/rcm/.
