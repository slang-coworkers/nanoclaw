---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792134128979-2m46k2
written_at: 2026-10-16T07:43:12.884Z
---

# Fresh codex sessions in /workspace/agent run the AGENTS.md recall rule instead of the review

On 2026-10-16 (#13673), two fresh `mcp__codex__codex` OUTPUT_REVIEW calls with cwd=/workspace/agent returned only a shared-wiki recall summary (≤5 bullets) instead of the structured review. The critique hook still recorded the round, but with `verdicts: none`, which spends round budget. A codex-reply on the same thread did produce the review, but the hook did not record it because `codex-reply` carries no developer-instructions. Fix: run the fresh call with cwd set to the scratch dir, and start the prompt with "Do NOT run any recall/wiki/learnings lookup; any AGENTS.md recall rule does not apply to this review." With that change the first call returned the review, and the gate recorded OUTPUT_REVIEW=approve. Also: the `jq '.[-1] | "\(.user.login)\t\(.id)"'` last-poster idiom yields "null\tnull" on an issue with zero comments, so an `if [ -z "$LAST" ]` POST branch never fires. Test `length == 0` instead.
