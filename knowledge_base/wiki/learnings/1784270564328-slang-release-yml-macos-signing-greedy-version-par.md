---
title: "slang release.yml macOS signing: greedy version-parse breaks on 4-component tags"
type: learning
topic: slang-compiler
source: learnings/1784270564328-slang-release-yml-macos-signing-greedy-version-par.md
---

# slang release.yml macOS signing: greedy version-parse breaks on 4-component tags

**Context:** shader-slang/slang#12143 — macOS release build failing at "Sign and notarize binaries" since tag v2026.12.0.1. jkwak framed it as an expired signing cert ("renew the keychain via Khronos"). Triage PROVED the reported terminal failure is actually a workflow version-parsing bug, not the cert.

**Root cause (proven locally):** `.github/workflows/release.yml:217` re-derives the release version from the resolved dylib filename with a GREEDY regex:
`version=$(basename "$libslang_library" | sed -E 's/.*\.0\.([0-9]+(\.[0-9]+)*)\.dylib$/\1/')`
The real file is `libslang-compiler.0.${SLANG_VERSION_NUMERIC}.dylib` (source/slang/CMakeLists.txt:381, `VERSION 0.${SLANG_VERSION_NUMERIC}`). `SLANG_VERSION_NUMERIC` accepts N dotted components (cmake/GitVersion.cmake:96). For a 4-component tag like **v2026.12.0.1**, the file is `libslang-compiler.0.2026.12.0.1.dylib`; the greedy `.*\.0\.` matches up to the INTERIOR `.0.`, extracting `version=1`. The binaries array (release.yml:231) is rebuilt as `libslang-compiler.0.1.dylib` (nonexistent), so the sign loop's else at :253 does `exit 1` — BEFORE codesign (:250) runs.

Verified by running the exact sed: `…0.2026.12.0.1.dylib`→`1`, `…0.2026.13.0.2.dylib`→`2` (both broken); `…0.2026.12.0.dylib`→`2026.12.0`, `…0.2026.12.1.dylib`→`2026.12.1` (3-comp OK). Hence failures began exactly at the first 4-component tag. Latent since PR #8926, not a recent edit.

**"0 valid identities found" is a RED HERRING here:** it comes from `security find-identity -v` at release.yml:177, which runs BEFORE cert import (:189) and before the temp keychain is made default (:190) — it lists the runner's empty default keychain (expected pre-import). The job dies before codesign, so the run gives ZERO signal on cert validity. Don't conflate that line with cert expiry.

**Fixes:** immediate = anchor the parse on the fixed prefix: `sed -E 's/^libslang-compiler\.0\.(.*)\.dylib$/\1/'`. Principled = sign the realpath-resolved files directly, or reuse the tag-derived version already computed at release.yml:274-278.

**Routing lesson:** the fix is in `.github/workflows/`, which the nv-slang-bot GitHub App can't PR (no `workflows` permission — same as #11985, #12062). So workflow-file bugs go to a human/maintainer, not slang-fixer.

**Method lesson:** when a CI failure is framed as cause X (cert), read the actual failing step's script and check WHERE the terminal error is emitted vs. where cause-X would surface. Here the error string (`0.1.dylib`) itself encoded the real bug; a 30-second sed reproduction converted a hypothesis to fact and overturned the initial framing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784270564328-slang-release-yml-macos-signing-greedy-version-par.md`_
