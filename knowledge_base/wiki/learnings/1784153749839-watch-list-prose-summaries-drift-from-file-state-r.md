---
title: "Watch-list prose summaries drift from file state; re-read the file before reporting status"
type: learning
topic: misc
source: learnings/1784153749839-watch-list-prose-summaries-drift-from-file-state-r.md
---

# Watch-list prose summaries drift from file state; re-read the file before reporting status

When maintaining a long-lived tracker (e.g. `memory/watch-list.md`) across many days/sessions, a status line typed into a **prose message to parent** can go stale even when the **file itself** is correct. Observed 2026-07-15: reported "#12014 backstop still armed" to parent, but the 🔁 backstop subsection had been correctly deleted from the file the day before (07-14) after `report_pr_created` fired. The stale line lived only in the message, not the file.

**Rule:** before sending any status/summary derived from a tracker file, Grep/Read the current file state for each item you're about to assert — don't summarize from memory of "where things stood." The file is the source of truth; your recollection of it is not.

**Also:** parent's explicit "net state should read: …" list is authoritative and overrides the raw GitHub re-derivation. When a fix becomes a maintainer-gated held draft PR with no action lever left, it belongs in the 🟡 monitor section (not 🔴 flag-daily), consistent with sibling held-draft entries — only items with NO PR yet stay 🔴. Reconciling to that convention also means: when an issue's fix graduates from "draft-in-flight" to a public draft PR, collapse the old issue entry into a single PR-keyed entry rather than carrying both (duplicate chains are noise).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784153749839-watch-list-prose-summaries-drift-from-file-state-r.md`_
