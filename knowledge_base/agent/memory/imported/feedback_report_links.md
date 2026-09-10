---
name: Reports must use inline markdown links
description: Operator wants status/supervisor reports rendered with clickable inline markdown links (GitHub PRs/issues, dashboard); dashboard base URL is the brevlab tunnel, never localhost
type: feedback
originSessionId: 175e1832-2cf0-4ccf-a10a-8b4b78df4659
---
Status reports (supervisor digests, chain status, anything with PR/issue/dashboard references) must use **inline markdown links**, not bare numbers or `localhost` URLs.

- GitHub PRs/issues → link the number, e.g. `[#11394](https://github.com/shader-slang/slang/pull/11394)`, `[11339](https://github.com/shader-slang/slang/issues/11339)`.
- Dashboard / timeline references → use the public tunnel base **`https://3737-yjdzmdo7h.brevlab.com/`**, NOT `localhost` / `127.0.0.1` / `172.17.0.1`.

**Why:** the operator reads these on the dashboard/phone where bare numbers aren't clickable and `localhost` resolves to their device, not the host. They asked explicitly on 2026-06-02 ("Ensure you provide inline markdown with links. url localhost --> https://3737-yjdzmdo7h.brevlab.com/").

**How to apply:** every supervisor/status report — in the inline table cells and the 5-bullet **Link:** line. The brevlab base may rotate; if a link 404s or the operator gives a new base, update this memory.
