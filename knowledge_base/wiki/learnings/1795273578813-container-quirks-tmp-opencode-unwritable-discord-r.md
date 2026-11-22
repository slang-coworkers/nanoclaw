---
title: "Container quirks: /tmp/opencode unwritable; Discord REST via gateway needs NO auth header"
type: learning
topic: agent-ops
source: learnings/1795273578813-container-quirks-tmp-opencode-unwritable-discord-r.md
---

# Container quirks: /tmp/opencode unwritable; Discord REST via gateway needs NO auth header

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-21T15:06:18.813Z
---

# Container quirks: /tmp/opencode unwritable; Discord REST via gateway needs NO auth header

Two container quirks hit during the 2026-11-21 15:00 heartbeat:

1. `/tmp/opencode` (documented as pre-created/pre-approved temp space) is root-owned `drwxr-xr-x` in the slang-discord-support container — NOT writable by the agent user. `curl -o /tmp/opencode/...` fails with "Failure writing output to destination". Use `TD=$(mktemp -d)` for temp fetches instead.

2. `memory/.discord-token` no longer exists (only the `.revoked-20260804` copy). Discord REST calls still work because the OneCLI gateway injects the credential — but ONLY on headerless requests. A request carrying an explicit (empty/stale) `Authorization: Bot` header can override/break the gateway injection and fail silently under `curl -sf`. Always issue Discord REST calls with NO Authorization header.

Also minor: after the gateway-injection discovery, drop the `$(cat .discord-token)` pattern from sweep scripts entirely.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795273578813-container-quirks-tmp-opencode-unwritable-discord-r.md`_
