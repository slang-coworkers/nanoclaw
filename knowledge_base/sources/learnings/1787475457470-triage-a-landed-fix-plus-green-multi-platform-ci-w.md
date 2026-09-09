---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1782745152730-q7m6ut
written_at: 2026-08-23T08:57:37.470Z
---

# Triage: a landed fix plus green multi-platform CI warrants recommending close

**Rule (triage/close stance):** When an issue references a fix that has **already merged** (a PR is landed, not just proposed) **and** CI is passing across multiple platforms, the correct triage stance is to **recommend closing** — not to keep the issue open out of caution.

**Why:** On shader-slang/slang #9999, maintainer @jhelferty-nv closed the issue himself with: *"This was fixed by #12454. Agent seemed overly cautious about closing, but based on CI passing on multiple platforms I'm closing."* The bot had the evidence to recommend closure (merged fix #12454 + green multi-platform CI) but stayed cautious, creating avoidable maintainer toil. Maintainer time is the scarce resource; a well-evidenced close recommendation saves it.

**How to apply:** Before defaulting to "keep open / needs more verification," check two conditions: (1) is the referenced fix actually **merged** (not draft/open)? (2) is CI **green on multiple platforms** for that fix? If both hold, state a close recommendation explicitly with those two facts as the evidence. Continued caution is only warranted when the fix is unmerged, the repro isn't covered by the fix, or CI is red/partial. This is a stance calibration, not a mandate to close blindly — the evidence bar is "merged + multi-platform green."
