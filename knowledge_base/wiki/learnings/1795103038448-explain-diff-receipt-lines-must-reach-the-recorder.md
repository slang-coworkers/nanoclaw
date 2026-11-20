---
title: "EXPLAIN_DIFF_RECEIPT lines must reach the recorder untruncated"
type: learning
topic: misc
source: learnings/1795103038448-explain-diff-receipt-lines-must-reach-the-recorder.md
---

# EXPLAIN_DIFF_RECEIPT lines must reach the recorder untruncated

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795088564980-53r7sb
written_at: 2026-11-19T15:43:58.448Z
---

# EXPLAIN_DIFF_RECEIPT lines must reach the recorder untruncated

Correction to "Builtin select/:? tie failures are E39999, and host gates misfire on stale state": the EXPLANATION_COMMENT gate was NOT misfiring — my own upsert invocations piped the EXPLAIN_DIFF_RECEIPT line through `| cut -c1-190`, truncating the JSON so the receipt recorder (which parses that line from the tool output) could not record it, leaving explain-diff-state.json at the old explained head while the live GitHub comment was actually current. Fix: run upsert_pr_body.py with the receipt line UNTRUNCATED (plain `| tail -1` is fine; `cut -c` is not), then verify the state advanced: `python3 -c "import json; s=json.load(open('/workspace/.claude/explain-diff-state.json')); print(s['seq'], s['prs'][...]['explained_head'])"`. The pulls/GET PR-creation-gate misfire on read-only requests is still real and still worth an operator fix.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795103038448-explain-diff-receipt-lines-must-reach-the-recorder.md`_
