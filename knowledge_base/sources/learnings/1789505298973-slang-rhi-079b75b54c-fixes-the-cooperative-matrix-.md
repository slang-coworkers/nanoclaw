---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789504076290-1z6sck
written_at: 2026-09-15T20:48:18.973Z
---

# slang-rhi 079b75b54c fixes the cooperative-matrix-2 name-granularity trap; render-test WAR removal is safe

Reviewing slang#13105 (bump external/slang-rhi d6d31411→079b75b54c + delete the `cooperative-matrix-*` accept-with-warning WAR in tools/render-test/options.cpp), verified read-only:

- **The slang#12735 granularity trap is FIXED at pin 079b75b54c.** Old pin checked only `cooperativeMatrixWorkgroupScope` and pushed one coarse `Feature::CooperativeMatrix2` → a device with the coarse bit but a missing sub-bit would RUN instead of SKIP. New pin (vk-device.cpp) detects each of the 5 sub-features via its OWN Vulkan bit and pushes its own Feature + SPIR-V capability (Reductions/Conversions/PerElementOperations/TensorAddressing/BlockLoads), and adds all 5 names to the `SLANG_RHI_FEATURES` X-macro + a slang-rhi unit test. So per-name SKIP is now correct.
- **Removing the render-test WAR is safe at gate 1.** render-test's `-render-feature` (NB: singular option name, not `-render-features`) is a two-stage gate: unknown name → hard `SLANG_FAIL` at parse (allow-list = SLANG_RHI_FEATURES from the pinned header); recognized-but-unsupported → runtime `SLANG_E_NOT_AVAILABLE` → test ignored. Repo-wide the only cooperative-matrix render-feature tokens used are exactly the 5 allow-listed names (no bare `cooperative-matrix-2`), so nothing regresses to a hard fail once the blanket-accept WAR is gone. Single caller at options.cpp:~146/165.
- **A "trivial pin bump" is rarely trivial — expand it via REST.** This bump was described as "add 5 feature names" but is actually 6 commits / ~90 files incl. public `include/slang-rhi.h` (+209/−24), a constant-buffer-pool→transient-buffer-heap rework, and new opacity-micromap + push-constant features. Diff-only reviewers (nv-slang-bot/Reviewer A) and CodeRabbit can't see inside `external/**`. Always run `gh api repos/shader-slang/slang-rhi/compare/<old>...<new> --jq '{ahead_by,files:[.files[].filename]}'` and state the true scope; a clean local build of slangc+slang-test+render-test is what proves source/link compat for the wider bump.
