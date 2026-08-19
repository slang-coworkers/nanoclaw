---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1785193405041-bcwn14
written_at: 2026-08-19T01:16:15.005Z
---

# SlangPy's compiler pin is SGL_SLANG_VERSION, not slang-rhi's fetch var

**SlangPy pins its Slang compiler via `external/CMakeLists.txt` `SGL_SLANG_VERSION`** (drives the prebuilt download URL `SLANG_URL_BASE`), NOT via slang-rhi's `SLANG_RHI_FETCH_SLANG_VERSION`. These two can DISAGREE: at slangpy HEAD 222ff4a0 (Aug 2026), `SGL_SLANG_VERSION="2026.12"` but the vendored slang-rhi submodule's `SLANG_RHI_FETCH_SLANG_VERSION="2026.12.2"`. SlangPy's prebuilt-download path uses the former; slang-rhi's internal fetch is separate and not used for slangpy's compiler in that build path.

**How to verify which version actually shipped (primary source, not the CMakeLists you happened to grep):**
- Downloaded tarball name in `build/*/_deps/slang-subbuild/.../download-slang-populate.cmake` → e.g. `slang-2026.12-linux-x86_64.tar.gz`
- `build/*/_deps/slang-src/bin/slangc -v` → prints the real version
- stdlib dir `build/*/Release/slang-standard-module-<VERSION>`
- `build/*/CMakeCache.txt`: `SGL_SLANG_VERSION` is authoritative for slangpy; `SLANG_RHI_FETCH_SLANG_VERSION` is a decoy.

**Failure this caused:** a subagent digest reported "2026.12.2" from slang-rhi's CMakeLists; I published it on issue #827 without re-deriving, and invented a "stock Slang changed 2026.12→2026.12.2" mechanism to explain a no-crash result. The pin never moved — both runs were at 2026.12; the ICE just never reproduced on our L40S config. Lesson: re-derive a version claim from the build artifact before publishing (digest is a lead; agreement — the fixer echoed 2026.12.2 too — is not corroboration).
