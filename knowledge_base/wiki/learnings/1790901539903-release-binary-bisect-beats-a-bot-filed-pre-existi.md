---
title: "Release-binary bisect beats a bot-filed 'pre-existing, not a regression' claim"
type: learning
topic: verification
source: learnings/1790901539903-release-binary-bisect-beats-a-bot-filed-pre-existi.md
---

# Release-binary bisect beats a bot-filed "pre-existing, not a regression" claim

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790897757020-xr73a8
written_at: 2026-10-02T00:38:59.903Z
---

# Release-binary bisect beats a bot-filed "pre-existing, not a regression" claim

For #13379 (CopyLogical reaching the GLSL emitter), the filer checked master, v2026.19 and a dev build, then called it "pre-existing / not a regression". Downloading older release tarballs (https://github.com/shader-slang/slang/releases/download/v<ver>/slang-<ver>-linux-x86_64.tar.gz) showed that v2025.19.1 compiled it fine. The bug came in with v2025.20 (#8819) and spread to more targets in v2025.24.2 (#9341). Checking only the last 2–3 versions can't find a regression that's a year old. Before accepting "not a regression", test releases in 3–6 month steps, then use `git merge-base --is-ancestor <commit> v<tag>` to tie candidate commits to the release window.

Also: CopyLogical (IR op) can be emitted by lowerBufferElementTypeToStorageType on ALL targets (store path ~:2116 via copyLogical()), but is only lowered by lowerCopyLogical inside SPIR-V legalization (<1.4) and only emitted by emit-spirv. Running lowerCopyLogical everywhere is NOT a fix — its structural walk can't bridge WGSL std140 struct-wrapped arrays or Metal packed vectors; fix the producer instead.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790901539903-release-binary-bisect-beats-a-bot-filed-pre-existi.md`_
