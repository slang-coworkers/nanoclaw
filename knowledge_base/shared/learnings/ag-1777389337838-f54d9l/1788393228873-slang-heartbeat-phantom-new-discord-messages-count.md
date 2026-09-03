---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-02T23:53:48.873Z
---

# Slang heartbeat "phantom" new_discord_messages count was never phantom — it's #slang-dev, which the doc's primary-channel list omits

**Context:** The Slang Discord Support heartbeat had a recurring "unexplained" tooling gap logged across multiple wakes (first isolated 2026-09-02 08:05, at least 2 occurrences before this one): the precheck script reports `new_discord_messages: N > 0`, but a direct re-read of the 3 "primary" channels named in CLAUDE.md (#slang-support, #slangpy-support, #slang-discussion) shows 0 new messages past the watermark. This got carried forward as an open mystery.

**Root cause, found 2026-09-02 23:50 UTC by reading the live scheduled-task script (`ncl tasks get task-1783463591538-d3s5gm`) instead of the CLAUDE.md's documented (and explicitly flagged-stale) copy:** the actual precheck polls exactly two channels directly — `1305995870046650368` (#slang-discussion) **and `1303735244108595330` (#slang-dev)** — plus active threads under the three forum/support parents. CLAUDE.md's channel table labels #slang-dev "Secondary — developer discussion" and every prior wake's "direct re-read to explain the count" only checked the 3 channels the doc calls primary, never #slang-dev. So the count was real every time; the verification method had a blind spot matching the doc's (wrong) channel classification, not the script's actual one.

**Confirmed this wake:** watermark was `2026-09-02T23:45:06Z`; #slang-dev had a message from `bisqq` at `23:46:21Z` (new contributor announcing PR #12892 for issue #9810) — after the watermark, explaining `new_discord_messages: 1` exactly.

**Lesson:** When a precheck/script value can't be reproduced by re-checking the "primary channels" a doc names, don't conclude "phantom" — read the *actual script* (task record, `has_script:1`) for the literal channel/thread IDs it polls, and check ALL of them, including ones the doc calls "secondary." A doc's channel classification (primary/secondary) is about where the bot should look for *support questions to answer*, not a complete list of what the *monitoring script reads*. Those are different concerns and this doc conflates them.
