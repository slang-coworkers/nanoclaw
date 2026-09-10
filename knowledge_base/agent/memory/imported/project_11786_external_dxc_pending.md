---
name: RESOLVED — #11786 remove external/dxc (maintainer self-closed, keep-as-is)
description: jkwak self-closed 2026-07-02 keeping vendored DXC headers (Approach A); license concern resolved by in-file OSS headers; vindicates triager's original rec
type: project
originSessionId: 50221a29-eaf0-4557-9b99-3056b4c2045c
---
**RESOLVED 2026-07-02 — jkwak self-closing, KEEP as-is (Approach A).** Final comment (issuecomment-4861189662): he reversed his de-vendor lean after finding both files carry University-of-Illinois Open Source license statements in their headers (WinAdapter.h = LLVM/UIUC, dxcapi.h = Microsoft/UIUC) → license concern resolved, keeping them vendored. Matches the triager's original recommendation (A). Fixer never dispatched. No bot GitHub post on close (would echo standing rec 4811401658). Bot did NOT close the issue — jkwak owns that. Chain closed on our end; re-engage only on a fresh bot-directed inbound.

--- history below ---

shader-slang/slang#11786 "Remove external/dxc directory" (jkwak-work, COLLABORATOR, "Dev Opened"/Type=Build). Triaged 2026-06-26 at master HEAD `1a0c2a6d1`: enhancement / low / build-system(CMake) / P3.

Verdict (triager, posted to GitHub issuecomment-4811401658): `external/dxc` is NOT a submodule — it's 2 vendored Microsoft DXC API headers (`dxcapi.h` + `WinAdapter.h`, ~66 KB, UOI-NCSA, REUSE-tracked). USED at compile time (`slang-dxc-compiler.cpp:38`, under `SLANG_ENABLE_DXIL_SUPPORT`) → cannot simply delete. Three options: (A) KEEP vendoring [recommended, lowest risk]; (B) couple C++ compile to runtime DXC fetch [avoid — breaks offline/fetch-skipped builds]; (C) fetch just the 2 headers decoupled from runtime fetch [if no-vendored-source policy mandated]. Overlaps in-flight Dev-Reviewed #11441 (Add SLANG_USE_SYSTEM_DXC) — same surface.

**2026-07-02 UPDATE — chain re-opened:** jkwak commented (issuecomment-4861143709): "Having the files in the slang repo can cause a **license issue**. If those files are needed, we should have them as a **submodule; or** we may **download specific files as part of CMake** configuration step." → overrides the "keep" rec with a license-driven de-vendor lean, BUT floats two mechanisms (submodule OR CMake download) without converging. Per re-open≠release: re-opens discussion, does NOT release the fixer (alternative-floating ≠ settled directive). Triager dispatched to reply on GitHub — acknowledge license concern, surface that the 2 API headers are distinct from FetchDXC's runtime path so a CMake-download must be DECOUPLED (Approach C, not B which breaks offline builds), and ask jkwak to name the mechanism.

**Why:** Maintainer-authored enhancement; keep-vs-remove and the de-vendor mechanism are the author's policy call. Overlaps #11441.
**How to apply:** slang-fixer stays HELD — do NOT auto-dispatch. Release only when jkwak names a single mechanism (submodule vs. decoupled CMake fetch). If he picks CMake download, that's Approach C, NOT B. If a supervisor sweep sees this idle, it's parked-by-design awaiting jkwak's mechanism convergence, not stalled.
