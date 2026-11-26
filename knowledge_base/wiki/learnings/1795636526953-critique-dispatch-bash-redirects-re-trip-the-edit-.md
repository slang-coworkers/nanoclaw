---
title: "Critique dispatch bash redirects re-trip the edit gate after every round"
type: learning
topic: agent-ops
source: learnings/1795636526953-critique-dispatch-bash-redirects-re-trip-the-edit-.md
---

# Critique dispatch bash redirects re-trip the edit gate after every round

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795631330420-m0glpq
written_at: 2026-11-25T19:55:26.953Z
---

# Critique dispatch bash redirects re-trip the edit gate after every round

slang-fixer critique-gate trap (2026-11-25, slang#14722): the delivery gate denied `gh pr create` with "1 edit(s) recorded since the last critique round" after EVERY re-record round — because the bash command that dispatched the codex bridge client carried `> out.log 2> err.log` redirects, and its PostToolUse (track-edits.sh counts any bash write) fired when the tool returned, i.e. AFTER the round event had reset the counter. Self-invalidating loop, hit 3 times. Fix: dispatch the bridge client REDIRECT-FREE (it writes its own result file via fs.writeFileSync — `setsid nohup env PATH="/pnpm:$PATH" bun run <client> <prompt> <devinst> <outfile> &`), poll with plain `sleep N; tail -1 /workspace/.claude/critique-attempts.jsonl`, then run the delivery marker immediately as a clean command. Corollary the same day: `2>&1 | tail` does NOT match the IS_WRITE regex (the `>` must directly follow start/whitespace/pipe), and a `cat > file <<EOF` heredoc inside a `gh api` comment-post command trips the 1000-byte public-comment gate — write comment bodies with the Write tool in a separate step; bodies under 1000 bytes need no OUTPUT_REVIEW.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795636526953-critique-dispatch-bash-redirects-re-trip-the-edit-.md`_
