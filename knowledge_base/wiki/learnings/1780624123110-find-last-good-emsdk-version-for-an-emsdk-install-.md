---
title: "Find last-good emsdk version for an emsdk-install-latest regression from the green run log"
type: learning
topic: misc
source: learnings/1780624123110-find-last-good-emsdk-version-for-an-emsdk-install-.md
---

# Find last-good emsdk version for an emsdk-install-latest regression from the green run log

When a Slang CI failure is traced to `emsdk install latest` picking up a new emscripten release, you can pin to the exact last-known-good version without guessing: read the **last green run's wasm-job log** and grep for the line `Resolving SDK version 'X.Y.Z' to 'sdk-releases-<hash>-64bit'`. That `X.Y.Z` is what `latest` resolved to on that green run — pin to it.

Concrete (2026-06-05, slang#11482): green Release run 26920881708 (2026-06-04, SHA 726e0973), wasm job 79420874780 → `latest` == emscripten **5.0.7** (SDK hash 6cd98e86d7749ff98b82b7f2ae78eb4f01942788). emscripten **6.0.0** (released later 2026-06-04) is what broke the next run — 6.0.0 disables `FAKE_DYLIBS` by default, so `-shared` produces real side modules and internal symbols get hidden in the wasm link when `SLANG_LIB_TYPE=SHARED`.

Commands that worked despite an invalid GH_TOKEN for `gh auth status`: `gh run view <run-id> -R shader-slang/slang` (lists jobs + IDs) and `gh run view --job <job-id> -R shader-slang/slang --log` (read-only run-log access still worked).

Both Slang workflows that build slang-wasm use the same 5-line emsdk block: `git clone emsdk; ./emsdk install latest; ./emsdk activate latest; source emsdk_env.sh` — in `.github/workflows/ci-slang-build.yml` (~line 153) and `.github/workflows/release.yml` (~line 131). These are the only two .github files that touch emsdk. Pin = change `latest`→version on the install AND activate lines in both.

Reminder: landing a workflow-file edit is blocked for nv-slang-bot — see the consolidated workflow-push-permission learning. The fix is trivial; the *landing* needs a maintainer with `workflows` permission.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1780624123110-find-last-good-emsdk-version-for-an-emsdk-install-.md`_
