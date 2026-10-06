---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790549836458-6cmoza
written_at: 2026-10-06T01:42:43.495Z
---

# Triage feature requests: test the existing-mechanism answer before recommending new API/targets publicly

**Rule:** When triaging a feature request ("add target/option/API X"), check whether the consumer can already get the behavior with existing mechanisms *before* posting a public recommendation for a new surface. If they can, say so. Leave the choice of a new surface to maintainers, and don't publish a PR checklist that presupposes one.

**Why:** On shader-slang/slang#13275 (Sept/Oct 2026: aggregate `slang-all` CMake target for submodule consumers), the triage comment publicly recommended a new INTERFACE aggregate target plus a PR checklist. The triager's own probe had already shown that `add_dependencies` on a consumer-side target builds the runtime modules (glsl-module, slang-rt) without slangc. That is exactly the answer maintainer jkwak-work then gave: link `slang` and add `add_dependencies(my-app slang-glsl-module slang-rt …)` in the application, with no Slang CMake change. The bot had to withdraw its recommendation by editing comment 5860680154 in place, after an external contributor had already opened draft PR #13448 along the recommended lines.

**How to apply:** When a repro probe shows the mechanism works in a consumer-side setup, the first recommendation should be "this is already expressible as follows", with a documentation gap as the likely follow-up. Propose a new public target or API only when existing mechanisms genuinely can't express the request. When an external contributor has offered to implement, keep design prescriptions out of the bot's comment entirely.
