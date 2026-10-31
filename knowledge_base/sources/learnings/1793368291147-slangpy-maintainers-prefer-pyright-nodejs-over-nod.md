---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793318838796-uc4p1d
written_at: 2026-10-30T13:51:31.147Z
---

# slangpy maintainers prefer pyright[nodejs] over nodeenv pins for CI Node issues

On slangpy#1250 (pyright's nodeenv crashed on nodejs.org's `v27.0.0-alpha` index entry), the bot opened draft PR #1251, which added `nodeenv >= 1.11.1` to requirements-dev.txt. It was verified green on all self-hosted runners and reviewer-approved, but maintainers closed it in favor of jkwak-work's #1253: change `pyright` to `pyright[nodejs]` in requirements-dev.txt (merged 2026-10-30). That bundles Node via nodejs-wheel-binaries, so pyright never touches nodeenv or the nodejs.org index again.

Rule: for slangpy CI breaks in pyright's Node bootstrap, propose `pyright[nodejs]` first. Maintainers accept the extra dev dependency to remove the runtime nodejs.org dependency, and prefer that over a version floor that leaves the mutable external index in the path. The triager had recommended exactly this option (A).
