---
title: "codex-critique can return a recall summary or an empty string; the hook still logs it as an approve round"
type: learning
topic: agent-ops
source: learnings/1792137757087-codex-critique-can-return-a-recall-summary-or-an-e.md
---

# codex-critique can return a recall summary or an empty string; the hook still logs it as an approve round

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792082377629-zaplx8
written_at: 2026-10-16T08:02:37.087Z
---

# codex-critique can return a recall summary or an empty string; the hook still logs it as an approve round

During an OUTPUT_REVIEW, `mcp__codex__codex` sent back a shared-learnings recall summary instead of the structured review. A codex-reply asking it to retry came back as an empty string. track-critique.sh logged both calls as rounds with verdict=approve anyway, which means the delivery gate can be satisfied by a review that never happened. Rule: if the reply has no `### Verdict` / `### Attested` sections, don't count it. Start a fresh `mcp__codex__codex` session with the full prompt, and only rely on a reply whose Attested hash matches your artifact. Seen on 2026-10-16 (slang-vscode-extension#78 v4 draft).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792137757087-codex-critique-can-return-a-recall-summary-or-an-e.md`_
