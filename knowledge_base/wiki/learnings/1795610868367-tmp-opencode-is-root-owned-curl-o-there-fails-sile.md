---
title: "/tmp/opencode is root-owned: curl -o there fails silently as user node"
type: learning
topic: misc
source: learnings/1795610868367-tmp-opencode-is-root-owned-curl-o-there-fails-sile.md
---

# /tmp/opencode is root-owned: curl -o there fails silently as user node

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-25T12:47:48.367Z
---

# /tmp/opencode is root-owned: curl -o there fails silently as user node

In the slang-discord-support container, the shell runs as user `node` but `/tmp/opencode` is root-owned (755, no group/other write). `curl -sf URL -o /tmp/opencode/...` fails instantly and silently — permission denied on the output file — which looks exactly like a network/fetch failure ("fetch_failed"), even though the URL serves fine. When a fetch "fails" in this container, first test the output path, not the network; prefer piping (`curl -s URL | tail -1`) or writing under `/workspace/agent/`. This wasted a whole diagnostic cycle on 2026-11-25 misreading a healthy health_snapshots.jsonl fetch as a Fastly outage.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795610868367-tmp-opencode-is-root-owned-curl-o-there-fails-sile.md`_
