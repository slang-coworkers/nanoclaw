# SLANG_OVERRIDE_DEP_PATH silently fails when a public header uses the bundled-parent include spelling

# SLANG_OVERRIDE_*_PATH override ignored for a public-header consumer

**Failure mode (slang#11851, imgui — generalizes to any bundled-dep override).** A `SLANG_OVERRIDE_<DEP>_PATH` can be set yet silently ignored for a target's *public-header consumers* even though the dep's INTERFACE target branches bundled-vs-override correctly. Two preconditions combine:

1. **Wrong include spelling.** The dep's INTERFACE target (external/CMakeLists.txt) sets its include dir to the **leaf** dir that *contains* the header (e.g. `external/imgui`, override `${SLANG_OVERRIDE_IMGUI_PATH}/imgui`). If a public header spells `#include "<dep>/<header>.h"` (prefixed) instead of the leaf `#include "<header>.h"`, the leaf dir can't satisfy it — it resolves only via some *other* incidental PUBLIC parent include dir (in slang's `tools/CMakeLists.txt`, the GLM branch publicly adds `${slang_SOURCE_DIR}/external`, hard-wired to the bundled tree). So the bundled copy shadows the override.
2. **Private consumption.** If the dep is `INCLUDE_FROM_PRIVATE` on the target, its include dir never propagates to consumers of the target's PUBLIC header → with the incidental parent dir gone (e.g. glm also overridden), the header is unfindable at all.

**Fix pattern.** Make the dep's INTERFACE target the single source of truth: (a) spell the include as the **leaf** form in the public header (match how the dep's own sources include it); (b) move the dep from `INCLUDE_FROM_PRIVATE` to `INCLUDE_FROM_PUBLIC` (cmake/SlangTarget.cmake: "headers we use in our headers, so dependencies of this target also include them"). Do NOT mirror a parent-`external` public branch (re-exposes broad external, duplicates the override branch = two sources of truth).

**Scope check:** a sibling dep also `#include`d by the public header (e.g. slang-rhi) can stay PRIVATE if its consumers link it DIRECTLY (resolves independently). Promoting it has no failing symptom → leave it (scope creep otherwise).

**Verification without a build (build-config fix, no .slang test, no docs matrix):**
- `clang++ -E` probe modeling the consumer include dirs CMake produces — make 2 fake leaf trees (bundled/relocated) with marker headers, compile a tiny consumer TU in each scenario, confirm pre-fix→bundled/FAIL and post-fix→relocated. Instant, proves the C-preprocessor resolution + override-honor + no-shadow.
- Empirical: `cmake ... -DCMAKE_EXPORT_COMPILE_COMMANDS=ON` (bundled, and override mode), then inspect compile_commands.json `-I`/`-isystem` for the affected TUs — confirms CMake actually places the leaf dir on the consumer's line.

**Tooling:** gersemi often missing in container → `pip install --break-system-packages gersemi==0.21.0`; format with `gersemi --no-warn-about-unknown-commands --definitions <all CMake files> --in-place <file>` (definitions teach it custom commands like `slang_add_target`).
