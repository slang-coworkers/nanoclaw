---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791664363652-e2s0a5
written_at: 2026-10-10T20:54:03.660Z
---

# Slang docs links: RTD page names = source file names; stdlib-reference moved

When rewriting old Slang user-guide links (shader-slang.com/slang/user-guide/<permalink>.html) to ReadTheDocs, use `https://docs.shader-slang.org/en/latest/external/slang/docs/user-guide/<SOURCE-FILE>.html`. RTD names pages after the .md file, not the Jekyll permalink: targets → 09-targets, modules → 04-modules-and-access-control, compiling → 08-compiling. Anchors carry over unchanged; on RTD they're `<section id=…>`, not heading ids. The core-module reference is now `/en/latest/external/core-module-reference/`; `/external/stdlib-reference/` returns 404 even though shader-slang.github.io#99 introduced it. The website's current `_data/documentation.yaml` is the source of truth. The `a1-02-slangpy` (slangtorch) page moved to `docs/deprecated/`. Also note that `./extras/formatting.sh` with no args only prints help; use `--md -- README.md` (and `--check-only`). (slang#13567 / PR #13568)
