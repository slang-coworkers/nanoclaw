---
title: "Dashboard channels render markdown — always include hyperlinks for issue/PR/discussion refs"
type: learning
topic: agent-ops
source: learnings/1778835191236-dashboard-channels-render-markdown-always-include-.md
---

# Dashboard channels render markdown — always include hyperlinks for issue/PR/discussion refs

## Dashboard formatting: use markdown + clickable hyperlinks

The `slang-maintainer-dashboard` channel (and similar dashboard channels surfaced through the NanoClaw harness) **renders markdown**, including hyperlinks. Every issue, PR, discussion, search query, and external reference you mention must be a clickable `[label](url)` markdown link — never a bare `#11120` or `repo:owner/name is:pr ...` string.

### Why this matters

On 2026-05-15 the dashboard-admin asked: _"Add hyperlink to the messages you have, so I can click it."_ — they were reading a maintainer report that mentioned `[#11107](...)` correctly but had a search query (`is:pr updated:>=...`) embedded as plain text in a code span. From the dashboard UI, plain text isn't actionable; they have to copy-paste it into GitHub. Markdown links eliminate that friction and are a core part of why the dashboard wants markdown reports in the first place.

The same admin previously asked (2026-05-11): _"give me report in markdown format next time"_ and (2026-05-11): _"Paste as markdown and have attachment."_ — confirming a consistent, durable preference.

### Concrete rules for `slang-maintainer-dashboard` (and any dashboard-style sink)

1. **Inline the full markdown body in the message AND attach the `.md` file** via `send_file`. Don't send a bullet summary with just a file path — the path isn't clickable in the dashboard's chat view.
2. **Hyperlink every reference**, not just issue/PR numbers:
   - Issue / PR: `[#11120](https://github.com/owner/repo/issues/11120)` (GitHub auto-resolves `/issues/N` to PRs and vice versa).
   - Discussion: `[#11107 — short title](https://github.com/owner/repo/discussions/11107)`.
   - Search query: link the rendered URL, e.g. `[search: ...](https://github.com/shader-slang/slang/pulls?q=is%3Apr+updated%3A%3E%3D2026-05-13T08%3A18%3A00Z)` — URL-encode `>` as `%3E`, `=` as `%3D`, `:` as `%3A`, spaces as `+`.
   - Generic feeds: `[open issues feed](...?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc)`, `[all discussions](...)`.
   - Repo references: `[shader-slang/slang](https://github.com/shader-slang/slang)`.
3. Use Unicode emoji (🚨 ⚠️ ✅ 🟢 ❌), not Slack/GitHub shortcodes.
4. Hierarchy: top-level `#` heading with the report title and ISO window, then `##` sections (Summary / Activity / Discussions / Notes / Data Collection Notes). The dashboard renders headings.
5. Date stamps in ISO 8601 (`YYYY-MM-DD` or full UTC); always include the window covered so a re-read days later still makes sense.
6. If you re-send a corrected version of an earlier message, label it explicitly ("re-sent ... with clickable links" / "This message replaces the previous version") so the admin can ignore the older one.

### When to apply

Every time you send a `/slang-maintain` report to the dashboard — daily sweeps, ad-hoc 1-hour pulses, release-notes drafts, issue-prioritization summaries. Also applies if a similar dashboard channel is wired in for SlangPy or NanoClaw groups: assume markdown rendering, link everything, attach the file.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1778835191236-dashboard-channels-render-markdown-always-include-.md`_
