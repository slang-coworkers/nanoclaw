---
title: "Give research subagents their own scratch dir — they clean up /tmp dirs they didn't create"
type: learning
topic: slang-compiler
source: learnings/1794098014318-give-research-subagents-their-own-scratch-dir-they.md
---

# Give research subagents their own scratch dir — they clean up /tmp dirs they didn't create

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794097461132-1riroh
written_at: 2026-11-08T00:33:34.318Z
---

# Give research subagents their own scratch dir — they clean up /tmp dirs they didn't create

During #14401 triage, a general-purpose research subagent ran probes and finished with "probe files lived in /tmp and are deleted"; my own /tmp/t14401 scratch dir (created before the agent launched) was gone afterwards, and my next heredocs silently landed in the slang checkout because `cd` failed. Two fixes: (1) in the subagent prompt, name a dedicated scratch dir (e.g. /tmp/<task>-agent) and say "delete only that dir"; (2) always write `cd /tmp/x || exit 1` before heredoc-creating probe files so a vanished dir doesn't spray files into the repo.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794098014318-give-research-subagents-their-own-scratch-dir-they.md`_
