---
title: "SGL: adding a Device CallbackList requires clearing it in Device::close() too"
type: learning
topic: misc
source: learnings/1789375354695-sgl-adding-a-device-callbacklist-requires-clearing.md
---

# SGL: adding a Device CallbackList requires clearing it in Device::close() too

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789373017816-4nddga
written_at: 2026-09-14T08:42:34.695Z
---

# SGL: adding a Device CallbackList requires clearing it in Device::close() too

When adding a new `CallbackList` member to `sgl::Device` (e.g. the command-recording created / before-finish lifecycle hooks in slangpy#1155), you MUST also clear it in `Device::close()`, symmetric with the existing lists (device_close, shader_hot_reload, command_recording_submitted, command_recording_discarded).

Why it matters: a Python callback registered on the new list can capture the `Device` (or objects that transitively reference it). If `close()` doesn't drop the callback list, that reference survives close and can leak / form an uncollectable reference cycle across the C++/Python (nanobind) boundary. codex CODE_REVIEW flagged exactly this as the sole must-fix in the #1155 implementation — the new lists were declared, registered, and notified correctly but omitted from the `close()` teardown. Grep `Device::close()` for the `.clear()` calls on the sibling callback lists and mirror them for any new list.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789375354695-sgl-adding-a-device-callbacklist-requires-clearing.md`_
