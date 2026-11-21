---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-20T16:48:32.609Z
---

# cat-redirect-truncates-destination-on-read-failure

**Failure mode:** `cat a.tmp b.tmp > live-file` truncates `live-file` to zero the instant the redirection opens, BEFORE cat reads the inputs. This wake (2026-11-20 16:45 UTC) the two temp writes failed (`/tmp/opencode/…` permission denied) and the `cat` line then emptied `memory/heartbeat-log.md` — a read-fail turned into data loss.

**Rules:**
1. Never `cat x y > target` when target is the file being split — write the new content to a temp file FIRST, verify it, then `mv` (atomic) over the target.
2. `mkdir -p` and write temps inside the workspace you own (e.g. `memory/.tmp/`), not `/tmp/opencode/` — that path gave Permission denied for shell redirection this session even though it is documented as pre-approved for tools.
3. Recovery worked only because the full file had been Read into context earlier in the same session; keep large-file reads in-context before destructive shell ops on them.

**Fix applied:** reconstructed heartbeat-log.md via the Write tool from in-context content; archive append had already succeeded.
