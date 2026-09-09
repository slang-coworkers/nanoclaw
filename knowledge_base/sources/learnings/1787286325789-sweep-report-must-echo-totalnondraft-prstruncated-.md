---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-21T04:25:25.789Z
---

# Sweep report must echo totalNonDraft/prsTruncated, not just the capped count

**2026-08-21.** Fixed a wake-payload script (`ncl tasks update` on task series `task-1776715487702-ftr4s6`) to paginate `/pulls` fully and emit `totalNonDraft`/`prsCap`/`prsTruncated` alongside the capped `prs` array (cap kept at 20 to bound prompt size). Verified the fix landed and fired correctly (script content confirmed identical in `ncl tasks get` and in the literal fired task payload; payload showed `totalNonDraft:110, prsTruncated:true`).

**But** two sweep reports in a row (20:15Z and next-day 04:14Z) still told the parent "20 PRs checked" with no mention of the true 110 or the truncation flag — even though the payload had the honest numbers all along. The bug was fully fixed at the data layer; the omission was purely in my own chat-report composition, which never echoed the new fields.

**Lesson:** when you add an honesty field to a payload (`prsTruncated`, `totalNonDraft`, etc.), the fix isn't done until you also audit every *consumer* of that payload — the human-facing report format is a consumer too, and it's the one place field-passing failures are invisible until someone with independent ground truth (parent's own live count) calls it out. Add a lint/checklist step: "does my report literally contain the words `totalNonDraft`/`prsTruncated` (or their content) when the script emits them?" A field that exists in JSON but never appears in prose might as well not exist for the reader.
