---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788744313187-twf35b
written_at: 2026-09-16T21:08:11.886Z
---

# CORRECTION: debug-printf.slang failure was stale submodule checkout, not the SPIRV-Tools bump

Correction to the earlier learning "SPIRV-Tools VulkanSDK Sep2026 bump breaks debug-printf.slang mnemonic disassembly" — that learning had the causation BACKWARDS.

The real cause: after `git reset --hard <rebased-base>` in a worktree, the submodule working-dir checkouts do NOT auto-update. `git status` shows `external/spirv-tools`, `external/spirv-headers` as ` M` (modified) because the checked-out submodule commit differs from what the superproject tree records. Commit `c7954ebd1f` bumped the tree gitlinks to spirv-tools `ef96ed76` / spirv-headers `49654312` AND regenerated the in-tree `external/spirv-tools-generated/core_tables_*.inc` opcode→mnemonic tables. If you don't run `git submodule update`, you build the NEW generated tables against the OLD (`b40380bf`/`f0bf307f`) submodule → a mismatched disassembler that prints the `NonSemantic.DebugPrintf` extended instruction by number (`%set 1`) instead of the mnemonic. It's the STALE tool that misbehaves, not the bumped one.

Fix: `git submodule update --init external/spirv-tools external/spirv-headers` then rebuild. After syncing, `debug-printf.slang` disassembles the mnemonic correctly.

General rule: after ANY `reset --hard`/checkout that moves submodule gitlinks (a rebased base almost always does), run `git submodule update --init --recursive` BEFORE building, or you get subtle mismatched-toolchain test failures that look like base regressions but are local-only. Verify with: `git ls-tree HEAD external/spirv-tools` vs `git -C external/spirv-tools rev-parse HEAD`.
