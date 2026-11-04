---
title: "Eval Runner: Review-Kind Scoring, Judge Failures, and Bank Freshness"
type: concept
group: agent-fixer-codex-skills
tags: [eval-runner, eval-slang-reviewer, review-eval, llm-judge, verifier, answer-json, review-history, slang-eval-tasks, judge-noise, bank-fetch, onecli]
source_count: 4
---

# Eval Runner: Review-Kind Scoring, Judge Failures, and Bank Freshness

Review-kind evals (`eval_run.py --kind review`, group `eval-slang-reviewer`) score a reviewer's `answer.json` findings with an LLM judge from the slang-eval-tasks bank. This page covers where that score goes wrong: drafts scored before the final answer, judge calls that fail silently or leave trials unknown, judge noise, and a bank checkout that silently goes stale. Dispatch, the triage answer contract and answer-key leaks are on [Eval Runner: Trial Isolation, Answer Contract, and Answer-Key Leaks](agent-eval-runner-trial-isolation-and-answer-leaks.md).

## TL;DR

- The runner scores the first answer.json that is unchanged across two polls 30 s apart. A reviewer that writes a placeholder (`"findings": []`, "DRAFT - pending verification") and then verifies for minutes is scored 0.0 on the placeholder. Compare each trial's `result.json` `answer` with the final file before trusting a job.
- The runner's `low_signal` flag (any repeat difference > 1e-9) marks almost every task when the reward is continuous; use the repeat spread instead.
- A single-sample review reward carries about ±0.1 of judge noise: the judge request sets no temperature.
- A verifier run from a background runner can fail on the local `ANTHROPIC_BASE_URL` relay (`Connection refused`) and leave the trial unknown. Re-score through the OneCLI HTTPS proxy with a placeholder token.
- `adapters/review_history.py` drops failed judge verdicts unlogged, so they count as "judged, no match", and its `GhClient` never retries. Wrap it to log non-ok verdicts and retry.
- A bank fix to the judge's JSON parse is live only where the generated files carry it; grep the per-task `test.sh` before assuming it.
- A failed bank fetch leaves the old remote-tracking refs, so a "checkout X, else origin/main" fallback silently runs a stale bank. A failed fetch does not prove a ref is missing: stop and report the credential problem.

## Drafts scored before the final answer

Some reviewer trials first write a placeholder answer.json (`"findings": []`, summary "DRAFT - pending verification" or "Preliminary ... verification in progress") and leave it unchanged for minutes while they verify. eval-runner-next scores the first answer that is the same on two polls 30 s apart, so it scores the placeholder (reward 0.0, "no findings"); the real review lands 8–25 min later. That happened in 4 of 60 trials of review-v1-current-20261103. Check a job by comparing each trial's `result.json` `answer` with the final `eval/<task>/r<k>/answer.json` on the group mount. Two fixes close it: the agent writes answer.json once, at the end, or the runner waits for the session to end before scoring. The same job showed the runner's `low_signal` flag (any repeat difference > 1e-9) firing on almost every task, because review rewards are continuous; judge stability by the repeat spread instead ([placeholder answer.json drafts get scored before the final answer](../learnings/1793723059993-eval-runner-review-kind-placeholder-answer-json-dr.md)). This is the review-kind form of the first-draft scoring hazard on the [trial-isolation page](agent-eval-runner-trial-isolation-and-answer-leaks.md).

## Judge failures, unknowns and noise

**A verifier run outside the agent's turn can lose its judge.** Review-kind verifiers (`tasks/review/*/tests/test.sh`) read `ANTHROPIC_BASE_URL`, which in a coworker container is `http://127.0.0.1:<port>`, a local relay. Run from a background eval runner, the verifier can get `judge unavailable: HTTP 0 ... [Errno 111] Connection refused` and leave the trial unknown with no reward.txt: 31 of 51 trials in review-v2-short-20261103. The working hypothesis is that the relay listens only while the agent's turn is active. Re-score with `env ANTHROPIC_BASE_URL=https://inference-api.nvidia.com ANTHROPIC_AUTH_TOKEN=ROUTED_VIA_ONECLI_PROXY AGENT_OUTPUT=<answer.json> REWARD_DIR=<trial>/verifier bash test.sh`: the OneCLI HTTPS proxy injects the real key, and the placeholder only tells the scorer a judge is configured. That scored all 31 trials in about 4 s each with the same judge model ([judge Connection refused unknowns, and how to re-score them](../learnings/1793741894835-review-eval-verifier-judge-connection-refused-unkn.md)).

**The judge is noisy.** Its request sets no temperature, and one answer judged twice by the same model gave 0.3716 and 0.4873, so a single-sample review reward carries about ±0.1 of judge noise. Compare variants over repeats, not one trial ([judge Connection refused unknowns, and how to re-score them](../learnings/1793741894835-review-eval-verifier-judge-connection-refused-unkn.md)).

**`review_history.py` hides judge failures.** In the bank's `adapters/review_history.py` a failed judge verdict is dropped without a log line, so every bot thread of that PR counts as "judged, no match" and `grep judge` on its log always shows 0. Its `GhClient` does not retry either: one transient GraphQL "Something went wrong while executing your query" ends a whole 212-PR run. The workaround is a wrapper that patches `review_scorer.Judge.judge` to log non-ok verdicts and patches `GhClient._exec` to retry; patch `_exec`, not `common._default_runner`, because the runner is bound as a default argument (eval-compliance `reports/r4/run-review-history.py`). On 2026-11-03, 3 of 134 judge calls failed because the reply was not valid JSON ("Extra data") ([review_history.py hides judge failures and has no gh retry](../learnings/1793713929111-eval-bank-review-history-py-hides-judge-failures-a.md)).

**A greedy JSON parse, and a bank fix that did not propagate.** The likely cause of those "Extra data" failures is the greedy `\{.*\}` in `Judge.judge`, which the review scorer shares ([review_history.py hides judge failures](../learnings/1793713929111-eval-bank-review-history-py-hides-judge-failures-a.md)). As of bank 2630d17 `review_scorer.py` has `first_json_object`, but the per-task `test.sh` files were not regenerated (`grep -c first_json_object` = 0), so verifiers still parse greedily ([judge Connection refused unknowns](../learnings/1793741894835-review-eval-verifier-judge-connection-refused-unkn.md)). Grep the files the verifier actually runs before saying a scorer fix is live.

## Bank freshness: a failed fetch is not a missing ref

When `git -C /workspace/agent/eval-bank fetch` fails (2026-11-03: the gateway's GitHub credential returned 401 Bad credentials for both git and `gh api`, with no connect_url), the old remote-tracking refs stay in place. A "checkout origin/review-tasks, else origin/main" step then quietly picks the stale origin/main (6d0cb9a, 2026-10-21). With that bank `eval_run.py --kind review` exits 2 with "no review tasks selected", because 6d0cb9a holds only triage, reply and fixer tasks. Stop the job and report the credential problem instead of falling back; the bank repo is private, so an anonymous `ls-remote` cannot stand in for the fetch ([eval bank fetch failure must stop the job](../learnings/1793704410952-eval-bank-fetch-failure-must-stop-the-job-not-fall.md)). A 401 here is an alert for the operator, per the standing rule that a scheduled job never fails silently on auth.

**Source learnings (4):**

- [eval-runner review kind: placeholder answer.json drafts get scored before the final answer](../learnings/1793723059993-eval-runner-review-kind-placeholder-answer-json-dr.md) — 4/60 trials scored 0.0 on a DRAFT; compare `result.json` with the final file; `low_signal` misfires on continuous rewards
- [eval-bank review_history.py hides judge failures and has no gh retry](../learnings/1793713929111-eval-bank-review-history-py-hides-judge-failures-a.md) — dropped verdicts read as "no match"; wrap `Judge.judge` + `GhClient._exec`; 3/134 "Extra data", greedy-regex hypothesis
- [Review-eval verifier: judge "Connection refused" unknowns, and how to re-score them](../learnings/1793741894835-review-eval-verifier-judge-connection-refused-unkn.md) — local relay down outside the turn; re-score via OneCLI with a placeholder token; ±0.1 judge noise; `first_json_object` not in test.sh
- [eval bank fetch failure must stop the job, not fall back to stale origin/main](../learnings/1793704410952-eval-bank-fetch-failure-must-stop-the-job-not-fall.md) — 401 leaves stale refs; stale bank → "no review tasks selected"; report the credential

_Catalog: [[wiki/index.md]]_
