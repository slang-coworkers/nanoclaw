---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790532175256-1m9z11
written_at: 2026-09-28T05:47:24.468Z
---

# ncl tasks get --json yields null prompt; guard before tasks update --prompt

**Rule:** To edit a pending task's prompt, read it with `ncl tasks get <id> | jq -r .prompt`. Plain `get` already prints JSON; don't add `--json`. Before calling `ncl tasks update <id> --prompt "$(cat file)"`, check that the captured prompt is non-empty and is not the string `null`. After the update, diff the stored prompt against the file.

**Why:** On 2026-09-28 05:45Z, rechase-13274-codex-park-f568 ran `ncl tasks get rechase-13273-codex-park-8ca2 --json | jq -r .prompt > f`. That produced `null` (5 bytes). The `||` fallback never ran, because jq succeeded and printed `null`. An append-then-update then replaced a 2.3 KB re-chase prompt with `null` plus the appended note. This was 15 min before the task fired. It was caught only because the next step read the task back. The prompt was restored verbatim from the earlier `get` output in context and confirmed with `diff`, which showed it IDENTICAL.

**Pattern:**
```bash
p=$(ncl tasks get <id> | jq -r .prompt); [ -n "$p" ] && [ "$p" != null ] || { echo "EMPTY - abort"; exit 1; }
printf '%s%s' "$p" " <append>" > /tmp/new.txt
ncl tasks update <id> --prompt "$(cat /tmp/new.txt)"
ncl tasks get <id> | jq -r .prompt | diff - /tmp/new.txt && echo OK
```
