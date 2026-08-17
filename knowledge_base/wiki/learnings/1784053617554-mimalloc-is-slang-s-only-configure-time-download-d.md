---
title: "mimalloc is Slang's only configure-time-download dep; making it an error is gated on submodule-vendoring first"
type: learning
topic: slang-compiler
source: learnings/1784053617554-mimalloc-is-slang-s-only-configure-time-download-d.md
---

# mimalloc is Slang's only configure-time-download dep; making it an error is gated on submodule-vendoring first

Triaging shader-slang/slang#12102 (jkwak-work's ask, off PR #12036 review): promote the silent `git clone` of mimalloc in `external/CMakeLists.txt` to a `FATAL_ERROR`.

**Verified facts (master 3eeda847c + PR #12036 head via `git fetch origin pull/12036/head`):**
- `external/mimalloc` is **NOT a submodule** — no `.gitmodules` entry on master OR the PR head, dir not committed. It's fetched on demand: `git clone --depth 1 --branch v2.1.7 ... OUTPUT_QUIET ERROR_QUIET` (master `external/CMakeLists.txt:268-281`). This is the **only** external dep that downloads at configure time; every other dep is a submodule and fails fatally via `add_subdirectory()` if missing. Precedent for the desired shape: `fast_float` override validation at `external/CMakeLists.txt:199-204` (FATAL_ERROR on missing override path).
- Security angle: the fetch resolves a **mutable, unpinned** git tag under `ERROR_QUIET`. Post-#12036 the checkout supplies `mimalloc-static` linked into `slang` (source/slang/CMakeLists.txt:367-368 on PR head), replacing global new/delete for the whole compiler DLL → a moved/compromised tag = arbitrary code in the shipped allocator.

**Key triage lesson — the "just make it an error" one-liner is NOT standalone:**
`SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC` defaults **ON on Windows** (`CMakeLists.txt:211-221`), so replacing the fetch with a bare FATAL_ERROR *without vendoring the source first* breaks fresh Windows clones (exactly what pdeayton-nv flagged). The principled fix couples both: **vendor mimalloc as a SHA-pinned submodule, THEN delete the fetch + error on missing source** — one change that satisfies the ask, keeps fresh clones working, and closes the mutable-tag hole (submodule pins an exact SHA). Also note: the current PR #12036 head already added a *partial* FATAL_ERROR (fires only on download *failure* when `SLANG_ENABLE_MIMALLOC` is set) — that does NOT close the hole, because a moved-tag fetch still *succeeds* silently.

General pattern: when a build-hardening issue asks to "turn a silent fetch into an error," always check whether the source is vendored (submodule) first — if it's download-on-demand, the error flip is gated on vendoring, or it breaks the default build.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784053617554-mimalloc-is-slang-s-only-configure-time-download-d.md`_
