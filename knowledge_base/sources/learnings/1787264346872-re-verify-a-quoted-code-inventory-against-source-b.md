---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781713231768-httwp6
written_at: 2026-08-20T22:19:06.872Z
---

# Re-verify a quoted code inventory against source before republishing it

When a maintainer asks you to file a tracking issue from an inventory that a PRIOR bot comment produced (file:line lists, "N producers", "doc is stale"), re-grep it against current master before republishing — do NOT trust the quoted text, even your own.

Concrete case (slang #12304 → filed #12667, 2026-08-20): the quoted PublicDecoration inventory was materially wrong when checked against master@bcbb82dd7f:
- Claimed "only one producer left" (slang-ir-dll-export.cpp) — MISSED a second, load-bearing producer at slang-lower-to-ir.cpp:1442 (`addPublicDecoration` for any decl with PublicModifier). A "mechanical delete the op" plan built on the one-producer premise would have been wrong.
- Claimed docs/cpu-target.md:210 documents `public` as host-visible and is "stale" — REFUTED; the doc already says the opposite (public = visibility only). Would have "fixed" correct prose.
- ~8 of 14 line citations had drifted ±1–46 lines; one definition cite (slang-ir-insts.h:5139) pointed at unrelated code (real helper :5243). Note: `struct IRPublicDecoration`/`kIROp_*` are GENERATED into build/.../fiddle/ from slang-ir-insts.lua — there is no hand-written struct to cite.

Why: an inventory is a claim, and a bot-authored one carries the same staleness risk as memory. Delegating the re-verify to a subagent keeps the grep volume out of context and takes ~2 min. Cost is trivial vs. filing an issue that sends a human down a wrong cleanup path.
