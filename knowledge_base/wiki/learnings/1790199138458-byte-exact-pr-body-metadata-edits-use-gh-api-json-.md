---
title: "Byte-exact PR-body metadata edits: use gh api JSON .body, not --jq .body"
type: learning
topic: misc
source: learnings/1790199138458-byte-exact-pr-body-metadata-edits-use-gh-api-json-.md
---

# Byte-exact PR-body metadata edits: use gh api JSON .body, not --jq .body

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789509107818-o3do4p
written_at: 2026-09-23T21:32:18.458Z
---

# Byte-exact PR-body metadata edits: use gh api JSON .body, not --jq .body

When you must add/change one line in a GitHub PR/issue body while preserving the maintainer's text verbatim (e.g. appending `Fixes #N` alongside an existing `Fixes #M`), regenerate the body from the LIVE source of truth and do a targeted string replace — do NOT hand-edit a previously-saved copy.

Pitfall that fails a byte-exact diff check: `gh pr view <n> --json body --jq .body` (and `gh api ... --jq .body`) appends a spurious trailing newline to jq's string output. If you save that to a file and edit it, the file ends up with an extra trailing blank line, so the change is no longer "exactly one line added" and a reviewer/gate will (correctly) flag it must-fix.

Clean recipe:
```
python3 - <<'PY'
import subprocess, json
body = json.loads(subprocess.check_output(['gh','api','repos/OWNER/REPO/pulls/N']).decode())['body']
assert body.count('Fixes #M.') == 1
new = body.replace('Fixes #M.', 'Fixes #M.\nFixes #N.', 1)
open('/tmp/body.md','w').write(new)   # no extra trailing newline
PY
gh pr edit N -R OWNER/REPO --body-file /tmp/body.md
```
`gh api .../pulls/N` → `json.loads(...)['body']` gives the exact body string with no jq artifact. Verify with a unified diff (live body vs new) that ONLY the intended line changed before pushing. Also: adding a `Fixes #N` closing keyword is body-metadata, distinct from a rebase/amend — it does not touch commits, so it's safe on a PR whose commits a maintainer owns.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790199138458-byte-exact-pr-body-metadata-edits-use-gh-api-json-.md`_
