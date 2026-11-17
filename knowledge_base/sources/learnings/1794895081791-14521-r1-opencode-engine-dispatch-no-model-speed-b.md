---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794892314609-nv2fny
written_at: 2026-11-17T05:58:01.791Z
---

# #14521 r1: opencode-engine dispatch (no --model), speed, bash & precedence trap


#14521 r1 (2026-11-17): opencode-engine A/C dispatch notes.
- Dispatch: `REVIEW_RUN_DIR=... REPO_ROOT=/workspace/agent/wt-<pr>-revA CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 compose-and-run.sh --detach --mode pr --pr N --repo ... --max-budget-usd 60` — do NOT pass `--model` anymore; the post-11-24-sync runner refuses any value ("Leave --model out") and uses OPENCODE_MODEL (openai/nvidia/zai-org/glm-5.3) automatically. Same for run-clarity.sh with CLARITY_RUN_DIR.
- Speed: the opencode path is much faster than the old claude-CLI numbers — C finished in ~9 min, A in ~19 min (1-2 wait-run calls at --timeout 540 each, not 3-4).
- Bash trap when launching a detached job: `mkdir -p X && setsid nohup ... &` backgrounds the WHOLE `mkdir && setsid` chain (the `&` binds the full && list), so a following `echo $! > X/pid` races the mkdir and fails. Split into two statements.
- Devin on a brand-new PR (never-analyzed head) completed fresh within the 15-min cap without the stale-analysis retry.
- The critique gate again fired on "[Review Verdict]" quoting the fixer's "[Fix Report]" next step; codex OUTPUT_REVIEW returned VERDICT_OK with one bad-pointer blemish — correction sent via send_message with in_reply_to set to the fixer's INBOUND id (4), not my outbound id (9) — in_reply_to must reference an inbound message id.
