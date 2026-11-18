---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794903240583-qf5sux
written_at: 2026-11-17T08:55:24.924Z
---

# slang-pr-review: 429 IP rate-limit recovery + opencode dispatch recipe (GLM group)

**slang-reviewer: NVIDIA inference API WAF IP rate-limit (429 CPE_RateLimit_IP) kills Reviewer A/C opencode orchestrators; recover subagent reports instead of re-running blindly (#14532 r1, 2026-11-17).**

- During a /slang-pr-review on shader-slang/slang#14532 (small diff), the shared egress IP got rate-limited by inference-api.nvidia.com's WAF. Run A-14532-r1 died at ~9 min (2/3 subagents done, REVIEW-GUARD FAIL); the retry A-14532-r1b run ALONE (C already finished, no other local load) died the same way at ~15 min — so the limit is fleet/IP-level, not caused by A+C concurrency, and an immediate retry is likely wasted. Two failed attempts = stop retrying (decision table attempt-2 rule).
- Recovery that worked: all three subagent reviews complete verbatim in `<run_dir>/subagents/chatcmpl-tool-*.output` even though final-review.md is a <500 B stub. Concatenate those into the combined report with a provenance header, mark the section "partial-but-complete-on-substance", set `"reviewers_complete":false` in the result JSON, and drift-check `tool-uses.jsonl` manually (grep matches for "POST/PR" are usually just subagent prompt text "do not post anything to GitHub" — inspect, don't just count).
- LLM-subagent exact-encoding arithmetic is unreliable: four different value guesses for `FloatToHalf(0x7fa12345)` appeared across A/C reports (0x7F04/0x7F08/0x7F09/0x308); the correct set is 0x7f800001→0x7E00, 0x7fa12345→0x7F09, 0x7fc12345→0x7E08, 0x7fffffff→0x7FFF (fraction 0x212345>>13 = 0x109). Verify any suggested exact test constant by hand before putting it in a verdict.
- The skill install now detects opencode as the engine for NANOCLAW_MODEL_WEIGHTS=open groups and the 11-24-sync review-engine "no override" behavior is live: dispatch A with `REPRO_PR_MODEL=openai/nvidia/zai-org/glm-5.3` (C: `CLARITY_MODEL=...`), REPO_ROOT pointing at a dedicated `wt-<pr>-rev{A,C}` shared clone, `REVIEW_RUN_DIR`/`CLARITY_RUN_DIR` under `/workspace/agent/runs/`. The old claude-CLI env recipe (ANTHROPIC_DEFAULT_*, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS) is obsolete.
- Devin on a draft PR with a never-analyzed head: first anonymous fetch triggered the analysis and completed fresh in ~9 min within the 15-min cap; check `devin-commit-status.txt` says "Analysis is up to date (head)" before using devin-flags.md.
