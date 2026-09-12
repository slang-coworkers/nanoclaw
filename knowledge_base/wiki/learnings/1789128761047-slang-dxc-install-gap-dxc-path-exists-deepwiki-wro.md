---
title: "Slang DXC: install gap, -dxc-path exists (DeepWiki wrong), UOI-NCSA text already shipped"
type: learning
topic: slang-compiler
source: learnings/1789128761047-slang-dxc-install-gap-dxc-path-exists-deepwiki-wro.md
---

# Slang DXC: install gap, -dxc-path exists (DeepWiki wrong), UOI-NCSA text already shipped

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789128183488-8xkktr
written_at: 2026-09-11T12:12:41.047Z
---

# Slang DXC: install gap, -dxc-path exists (DeepWiki wrong), UOI-NCSA text already shipped

Triaging shader-slang/slang#13007 ("ship source-built DXC in release packages"). Deltas beyond the existing wiki DXC/FetchDXC pages:

- **The exact "DXC not in release packages" gap:** `cmake/FetchDXC.cmake` stages `dxcompiler`/`dxil` into the build tree via the custom targets `copy-dxcompiler`/`copy-dxil` (copy sites ~:755-792 source-build, ~:877-918 prebuilt) but contains **zero `install(...)` calls**, and those bare custom targets are never handed to `install()` (they're not `slang_add_target`s). So they're absent from every install component ⇒ CPack (`release.yml`) never packages DXC. Cleanest fix pattern: route through `install_fetched_shared_library` (`cmake/FetchedSharedLibrary.cmake:143-154`) — the same helper `slang-llvm` uses in `cmake/LLVM.cmake:20-39`.

- **`-dxc-path` CLI override DOES exist** — `slang-options.cpp:1042-1048` (`-<compiler>-path` → `OptionKind::CompilerPath` → `setDownstreamCompilerPath`). DeepWiki explicitly (and wrongly) answered that there is no such override. Trust the source, not DeepWiki, for CLI-flag existence questions. DXC is loaded by **bare library name** (`DXCDownstreamCompilerUtil::locateCompilers` → `loadSharedLibrary`, OS resolver), and installed binaries carry `INSTALL_RPATH "$ORIGIN/../lib;$ORIGIN"` — so a DXC dropped next to the Slang binaries is auto-found; shipping DXC needs no C++/ABI change, only CMake install()/CPack + a license file.

- **License text is already half-shipped:** the source-built DXC (from the pinned commit) is UIUC/NCSA-only, and that text (`LicenseRef-UOI-NCSA.txt`) is **already present in `LICENSES/`** and installed. So the source-built path needs only a `REUSE.toml` binary annotation, not a new license file. The Microsoft *prebuilt* archives (Windows/Linux default) carry `LICENSE-MS.txt`, which is the licensing concern maintainers flagged (#11441/#11786).

- **Platform split matters for any "ship DXC" work:** the macOS release build already source-builds DXC today (release.yml doesn't force `SLANG_DXC_BUILD_FROM_SOURCE=OFF`), so a permissive artifact exists but is uninstalled; Windows/Linux release use MS prebuilts. "Ship source-built everywhere" ⇒ must force the source build on Win/Linux release too (longer/larger builds).

- **Routing:** this class of feature (reverses a prior stated maintainer position + a licensing/policy call + an external contributor volunteering the PR) is direction-gated → triage + map + comment, but do NOT dispatch a fixer preemptively; recommend the maintainer decision to parent. Same pattern as prior design-gated features.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789128761047-slang-dxc-install-gap-dxc-path-exists-deepwiki-wro.md`_
