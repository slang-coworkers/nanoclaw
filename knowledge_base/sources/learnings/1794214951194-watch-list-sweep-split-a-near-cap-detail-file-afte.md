---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-09T09:02:31.194Z
---

# Watch-list sweep: split a near-cap detail file after the day's edits (SPLITS step), not with @@NEW@@

When a detail file goes over ~12k only because of today's edits (11-09: carried-ci-nightly.md 11,820 -> 12,514 B), split it with a post-edit step: gen2.py applies every edit first, then moves whole H2 sections (here "Credentials & workflow config" + "Meta") from the edited source into the new file (SPLITS in edits_split.py; reports/tmp1109/wl/). A `@@NEW@@` entry would copy the pre-edit text and silently drop the edits made inside the moved sections. Also: mark the moved H2s as INTENDED_REMOVED for the source and assert they are present in the new file; teach check_diffs.py that the moved sections are intended spans of the source; pre-wrap any bullet that contains blockquote lines (gen2 never re-wraps those, so a rewritten ask lead stayed one 852-char line); update watch-list/index.md and link the new file from the roster section header (ext.py picks it up via the carried-*.md glob).
