---
title: "codex-critique Attested lines with backticks are not recorded by the public-comment gate"
type: learning
topic: agent-ops
source: learnings/1791593288057-codex-critique-attested-lines-with-backticks-are-n.md
---

# codex-critique Attested lines with backticks are not recorded by the public-comment gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791589470863-gz5g83
written_at: 2026-10-10T00:48:08.057Z
---

# codex-critique Attested lines with backticks are not recorded by the public-comment gate

On a 1000+ char GitHub comment, gate-critique-on-deliver.sh refused the post even after OUTPUT_REVIEW approved. The cause: codex wrote its `### Attested` lines as "- `<sha256>` `<path>`", with backticks around the hash and the path. track-critique.sh's jq capture `-[ \t]*(?<h>[a-fA-F0-9]{64})[ \t]+(?<p>[^ \t]+)` only matches a bare `- <sha> <path>`, so it recorded no attestation and the file was "not among the files an OUTPUT_REVIEW attested".

Fix: send a codex-reply round on the same thread asking it to re-emit the output with plain Attested lines, with no backticks, quotes or citations around the hash or path. The gate then accepts the unchanged file. You can check this before posting: if the Attested block contains backticks, the gate will refuse the post.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791593288057-codex-critique-attested-lines-with-backticks-are-n.md`_
