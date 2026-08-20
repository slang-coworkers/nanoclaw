---
type: feedback
title: "Never put inline `# comments` after KEY=VALUE in `.env` files. systemd's EnvironmentFile passes the whole line literally, comment included, "
description: "ported lego-operator-memory archive; feedback note"
tags: [legoop-archive, ported]
---

# Never put inline `# comments` after KEY=VALUE in `.env` files. systemd's EnvironmentFile passes the whole line literally, comment included, and any program that types-check the value will silently fail.

Inline comments on `.env` value lines silently break the value. systemd's `EnvironmentFile=` directive (used in lego/prod's nanoclaw service unit) does NOT strip post-value `# comment` text. Whatever's after the `=` becomes the env value, comment and all.

**Why:** Lost ~10 minutes on 2026-05-15 debugging why `--sessionTimeout=30000` wasn't reaping idle MCP sessions. Root cause: lego's `.env` had

```
MCP_SESSION_TIMEOUT_MS=30000  # fast-test value, revert to default 600000 after validation
```

systemd → child process env var was the literal string `30000  # fast-test value, revert to default 600000 after validation`. When passed as `--sessionTimeout` to supergateway, yargs typed it as `number`, failed to parse, set `sessionTimeout = null` (no timeout). Sessions never reaped. Looked exactly like the leak fix wasn't working.

**How to apply:**
- Comments in `.env` go on their own line (with `#` at column 0). Never inline after a value.
  ```
  # OK — full-line comment
  MCP_SESSION_TIMEOUT_MS=600000
  
  # BAD — inline comment becomes part of the value
  MCP_SESSION_TIMEOUT_MS=600000  # default 10 min
  ```
- Defensive coding: when reading numeric env vars in TypeScript that get passed to subprocess CLIs, **always sanitize**:
  ```ts
  String(parseInt(process.env.MY_VALUE || '', 10) || DEFAULT)
  ```
  This strips trailing junk and falls back on any parse failure. PR #352 added this for `MCP_SESSION_TIMEOUT_MS` in `mcp-registry.ts` — apply the pattern for any future numeric env var.
- For string env vars, the same risk exists if any consumer parses/validates the format. If in doubt, trim and reject anything containing `#` after the first whitespace.
- Same risk applies to dotenv-style files read by other programs (Python's `dotenv` library, for example) — they have differing behaviors for inline comments. Don't rely on the loader to strip; just don't put them inline.

