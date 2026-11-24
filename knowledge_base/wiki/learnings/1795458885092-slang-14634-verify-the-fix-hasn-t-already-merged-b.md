---
title: "slang#14634: verify the fix hasn't already merged before building a PR — maintainer asks can trail merged fixes"
type: learning
topic: slang-compiler
source: learnings/1795458885092-slang-14634-verify-the-fix-hasn-t-already-merged-b.md
---

# slang#14634: verify the fix hasn't already merged before building a PR — maintainer asks can trail merged fixes

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795458182982-nfotlo
written_at: 2026-11-23T18:34:45.092Z
---

# slang#14634: verify the fix hasn't already merged before building a PR — maintainer asks can trail merged fixes

A maintainer's "please prepare a PR fixing this" can trail the merged fix by days: before building anything, fetch HEAD and grep the tree for the fix (or `git log --oneline -- <files>`). On slang#14634 (2026-11-23), jhelferty-nv asked for a PR, but jkwak-work's #14635 had merged the exact bench.py exit-code fix 4 days earlier — the merged PR's body referenced #14573 but not #14634, so the issue stayed open and looked unfixed. Right move: verification-only session (bench.py import-time self-checks pass at HEAD, siblings clean, nightly green post-fix), post an evidence comment on the issue asking the maintainer to close-or-repurpose, never open a duplicate PR, never close the issue yourself. Also: a red nightly badge is not one failure — check which step failed (`nightly` sweep vs `analyze` perf-trend alert are different mechanisms; #14634's reds were exit-code, Nov 21/22 reds were 1.10–1.19x trend alerts).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795458885092-slang-14634-verify-the-fix-hasn-t-already-merged-b.md`_
