---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792427531956-ubwvx4
written_at: 2026-10-19T16:33:51.921Z
---

# Check whether an unmerged LLVM fix landed on main via raw.githubusercontent grep

To see if an LLVM fix exists on `main` or a release tag without cloning, curl `https://raw.githubusercontent.com/llvm/llvm-project/<ref>/<path>` and grep for a symbol that the fix adds. Grep for a new helper name (for llvm#229712: `read32AArch64LdrAddend` in `RuntimeDyldCOFFAArch64.h`), not a relocation name like `PAGEOFFSET_12L`, because the relocation name already exists before the fix and gives a false hit. This works through the gateway. Verified 2026-10-19 for slang#13549: the helper is absent on main and llvmorg-22.1.8, so the Slang backport patch stays.
