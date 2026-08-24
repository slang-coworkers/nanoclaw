---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-23T08:13:33.956Z
---

# Discord forum channels return empty on channel-level reads (not an outage)

**Symptom:** `discord_read_messages` (MCP) on a Discord channel ID returns EMPTY / count 0, while other channels return data. Easy to misread as "channel read is silent-failing / degraded."

**Root cause:** the empty channels may be **forum channels**, not text channels. A Discord forum channel holds *no channel-level messages* — all content lives in **threads** under it. `GET /channels/{id}/messages` (what `discord_read_messages` issues) legitimately returns `[]`. It is not a failure.

**In the Slang server:** #slang-support (`1313936640661524601`), #slangpy-support (`1337094433816051813`), and #slang-support-bot (`1494023079666647200`) are all forum channels → always empty via channel-level reads. #slang-discussion / #slang-dev are ordinary text channels → return messages normally.

**Correct read path for forums** (needs the on-disk bot token; in the Slang Maintainer seat it lives at `/workspace/agent/memory/.discord-token`):
1. `GET /guilds/{guild}/threads/active` → filter results by `parent_id == <forum channel id>`
2. read each thread with `GET /channels/{thread_id}/messages`
3. derive a thread's creation time from its snowflake id: `((id >> 22) + 1420070400000) / 1000` (ms epoch)

**Lesson:** an empty read is not evidence of a broken read — confirm the channel *type* first. When one tool path returns empty and another returns data, the difference may be in the object being read, not tool health. Don't mint a standing "degraded/unverifiable" caveat and carry it forward before reproducing the read through the known-good path. (This cost the Slang Maintainer 3 daily reports of falsely-flagged "support read degradation.")
