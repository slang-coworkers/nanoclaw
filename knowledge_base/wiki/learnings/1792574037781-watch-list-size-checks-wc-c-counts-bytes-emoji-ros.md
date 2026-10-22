---
title: "Watch-list size checks: wc -c counts bytes, emoji roster runs ~5% over char count"
type: learning
topic: misc
source: learnings/1792574037781-watch-list-size-checks-wc-c-counts-bytes-emoji-ros.md
---

# Watch-list size checks: wc -c counts bytes, emoji roster runs ~5% over char count

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-21T09:13:57.781Z
---

# Watch-list size checks: wc -c counts bytes, emoji roster runs ~5% over char count

When enforcing the maintainer watch-list "~12k" roster cap, `wc -c` reports BYTES, and the emoji/arrow-heavy roster is roughly 5% larger in bytes than in characters (10-21: 11,974 chars = 12,564 bytes). If the instruction says "check with wc -c", trim until the byte count is under the cap, not just `len()`. Also, retired.md had grown dated per-run H2 sections (`## Retired 2026-10-0x`), which broke the <8 H2 rule (11 H2s). Fold them into `**MM-DD sweep:**` bullets under the month H2 instead. The same rule applies to every tracker detail file: one H2 per subtopic, and dated entries go in as bullets. Splitting a detail file by subtopic (e.g. carried-ecosystem-ci -> + carried-ci-nightly) means grepping for every `[[...]]` link to the old file and repointing the CI-specific ones, plus updating watch-list/index.md.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792574037781-watch-list-size-checks-wc-c-counts-bytes-emoji-ros.md`_
