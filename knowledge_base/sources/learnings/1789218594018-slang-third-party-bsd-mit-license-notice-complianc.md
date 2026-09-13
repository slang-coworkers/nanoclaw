---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1785459605343-adedqn
written_at: 2026-09-12T13:09:54.018Z
---

# Slang third-party BSD/MIT license-notice compliance: ship the dep's own file, not a bare SPDX template

**Context:** shader-slang/slang #12302 / PR #13021 (merged a90dfa31, 2026-09-12). Reporter (vcpkg) flagged that statically-linked vendored deps' copyright notices weren't reproduced in redistributed binaries, violating the BSD binary-redistribution clause.

**The gap (class defect, not one-off):** vendored submodules statically linked into shipped libs — `cmark` (BSD-2 + embedded MIT), `lz4` (BSD-2), `glslang` (BSD-3), and the MIT/Apache class (miniz, mimalloc, unordered_dense, spirv-tools) — have their notices reproduced nowhere in the package. `reuse lint` does NOT catch this: the `reuse-compliance` CI (`fsfe/reuse-action`) checks out WITHOUT submodules, so submodule contents are outside its scope entirely; it passes green while saying nothing about them.

**The fix that works (and the two traps):**
1. **Ship each dep's OWN `COPYING`/`LICENSE` file** into a package `third-party-notices/` dir via the CPack `metadata` install component (`CMakeLists.txt`), renamed to disambiguate (`cmark-COPYING`, `lz4-LICENSE`, `glslang-LICENSE.txt`). NOT a generic `LICENSES/BSD-2-Clause.txt` template — BSD/MIT require the *specific copyright-holder line*, which the SPDX template lacks; and cmark's `COPYING` is multi-license (BSD-2 © MacFarlane + MIT © Vicent Martí/houdini + MIT © GitHub/buffer), so one BSD-2 template covers none of it.
2. **TRAP — reuse-lint unused-license:** dropping a bare `LICENSES/BSD-2-Clause.txt` into the repo REDS the `reuse-compliance` CI ("unused license") because no checked-out file references it (submodules absent in CI). Ship notices as install-only files outside the REUSE-scanned set, or register via tracked `REUSE.toml` `[[annotations]]` — never bare template files.
3. **WASM packages bypass CPack:** the Emscripten binary + static-libs packages are hand-assembled in `release.yml` (`cp -R`), so they need the notices `cp`'d in explicitly (glslang excluded — not in the WASM build). Guard each install on the vendored-source flags (`SLANG_OVERRIDE_*_PATH`, `SLANG_USE_SYSTEM_*`) so notices ship only when the vendored submodule is the actual build source.

**Process lessons:** (a) The bot's GitHub App token cannot push `.github/workflows/*` (missing `workflows` permission) — deliver workflow changes as a patch for a maintainer to `git apply`, and generate it via real `git diff`/`format-patch` + `git apply --check` (a hand-assembled inline patch was corrupt and rejected). (b) A PR where the maintainer both pushes the head AND is the sole approver stays `mergeStateStatus=BLOCKED` despite `reviewDecision=APPROVED` — branch protection "require approval of the most recent push (by a non-pusher)"; resolution is maintainer-side (2nd approval or admin-merge).
