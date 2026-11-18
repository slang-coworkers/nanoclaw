# slang-coworkers-prod: per-group configuration of record

Two kinds of agent-group configuration on the prod box are not composed from the repo: a group's
`groups/<folder>/instructions.prepend.md` (prepended to its composed `CLAUDE.md` at spawn, untracked on the
box), and its explicit MCP tool allow-list (`agent_groups.allowed_mcp_tools`, set with
`ncl groups mcp-tools set`). This directory is the record of both. The box must match it; a change is made
here first, merged to nv-main, and then applied on the box with the commands below.

| File                                    | Lives on the box as                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `slang_maintainer/instructions.prepend.md` | `~/slang-coworkers-prod/nanoclaw/groups/slang_maintainer/instructions.prepend.md` |
| `mcp-allowlists.json`                   | `agent_groups.allowed_mcp_tools` of each folder it names                     |

## What these records hold

- **slang_maintainer** monitors Discord read-only. It posts in Discord only for the weekly PR report; answering
  community questions belongs to the separate slang-discord-support coworker, which replies only when a
  thread's author summons it. Its allow-list therefore has no `mcp__slang-mcp__discord_send_message`.
- **slang-discord-support** is the one coworker that may answer in Discord, so its allow-list keeps
  `discord_send_message`.
- **eval-compliance** reads Discord only.

Only an explicit list restricts (see `src/mcp-allowlist.ts`). A group with no stored list inherits, and
inheriting restricts nothing: the coworker-type manifest is a composition input, never a permission grant.
So `ncl groups mcp-tools set --tools inherit` lifts a restriction; it never restores one.

## Apply on the box

Run from the prod checkout, on hostname `brev-m94ubmtdb`:

```bash
H=$(hostname); [ "$H" = brev-m94ubmtdb ] || { echo "wrong host: $H"; exit 9; }
cd ~/slang-coworkers-prod/nanoclaw

# Prepend: the group's next spawn composes it; the stale-CLAUDE.md sweep restarts its running containers.
install -m 644 ops/slang-coworkers-prod/agent-groups/slang_maintainer/instructions.prepend.md \
  groups/slang_maintainer/instructions.prepend.md

# Allow-lists: each `set` narrows the proxy scope of the group's live tokens at once and restarts its containers.
python3 - <<'PY'
import json, sqlite3, subprocess
lists = json.load(open("ops/slang-coworkers-prod/agent-groups/mcp-allowlists.json"))
db = sqlite3.connect("file:data/v2.db?mode=ro", uri=True)
for folder, tools in lists.items():
    (gid,) = db.execute("select id from agent_groups where folder = ?", (folder,)).fetchone()
    subprocess.run(["./bin/ncl", "groups", "mcp-tools", "set", "--id", gid, "--tools", json.dumps(tools)], check=True)
PY
```

## Verify the box matches

```bash
cd ~/slang-coworkers-prod/nanoclaw
diff -u ops/slang-coworkers-prod/agent-groups/slang_maintainer/instructions.prepend.md \
  groups/slang_maintainer/instructions.prepend.md && echo "prepend: matches"
python3 - <<'PY'
import json, sqlite3
lists = json.load(open("ops/slang-coworkers-prod/agent-groups/mcp-allowlists.json"))
db = sqlite3.connect("file:data/v2.db?mode=ro", uri=True)
for folder, tools in lists.items():
    (stored,) = db.execute("select allowed_mcp_tools from agent_groups where folder = ?", (folder,)).fetchone()
    print(folder, "matches" if json.loads(stored or "null") == tools else f"DIFFERS: {stored}")
PY
```
