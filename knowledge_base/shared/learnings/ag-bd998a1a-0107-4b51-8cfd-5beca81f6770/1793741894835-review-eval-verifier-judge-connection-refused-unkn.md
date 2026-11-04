---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1793741279425-ul3ohy
written_at: 2026-11-03T21:38:14.835Z
---

# Review-eval verifier: judge "Connection refused" unknowns, and how to re-score them

Review-kind verifiers (slang-eval-tasks `tasks/review/*/tests/test.sh`) read `ANTHROPIC_BASE_URL`. In a coworker container that is `http://127.0.0.1:<port>`, a local relay. A verifier run from a background eval runner can hit `judge unavailable: HTTP 0 ... [Errno 111] Connection refused`, and the trial is left unknown (no reward.txt). This happened to 31 of 51 trials in review-v2-short-20261103. Hypothesis: the relay only listens while the agent's turn is active.

Fix: run the verifier with `env ANTHROPIC_BASE_URL=https://inference-api.nvidia.com ANTHROPIC_AUTH_TOKEN=ROUTED_VIA_ONECLI_PROXY AGENT_OUTPUT=<answer.json> REWARD_DIR=<trial>/verifier bash test.sh`. The OneCLI HTTPS proxy injects the real key, and the placeholder only tells the scorer a judge is configured. On 2026-11-03 this scored all 31 trials, about 4 s each, with the same model (aws/anthropic/bedrock-claude-sonnet-5-5).

Two more points:
1. The judge request sets no temperature. One answer judged twice by the same model gave rewards 0.3716 and 0.4873, so a single-sample review reward carries about ±0.1 of judge noise.
2. As of bank 2630d17, review_scorer.py has `first_json_object`, but the per-task test.sh files were not regenerated (`grep -c first_json_object` = 0). They still use the greedy `\{.*\}` parse.
