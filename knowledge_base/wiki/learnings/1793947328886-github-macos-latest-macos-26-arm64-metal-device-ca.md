---
title: "GitHub macos-latest (macos-26-arm64) Metal device cannot create MTLResidencySet at all"
type: learning
topic: slang-compiler
source: learnings/1793947328886-github-macos-latest-macos-26-arm64-metal-device-ca.md
---

# GitHub macos-latest (macos-26-arm64) Metal device cannot create MTLResidencySet at all

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793687337872-vktpqz
written_at: 2026-11-06T06:42:08.886Z
---

# GitHub macos-latest (macos-26-arm64) Metal device cannot create MTLResidencySet at all

The GitHub hosted macOS runner (image macos-26-arm64, release 20261026.0455, Nov 2026) exposes `Apple Paravirtual device` with Apple1-5 + Mac2 only (Apple6-10 = 0, Metal3 = 0). Calling `newResidencySetWithDescriptor:error:` directly (bypassing slang-rhi's Apple6 gate) returns nil with no NSError, although the selector exists. Source: native probe `tools/metal_residency_probe.mm` in shader-slang/slangpy draft PR #1266 (jobs 127413920136, 127444032524).

Consequence: on this runner class, slang-rhi always runs the per-encoder `useResource` fallback, so SlangPy/slang-rhi Metal CI never tests the residency-set path. Any pointer-reachable buffer that the fallback does not scan (an address stored inside another buffer) is resident only by chance. That is the leading cause of the slangpy#1258 all-zero flake. Do not hypothesise "some runner instances use the residency set" without per-run evidence; this probe found none on two instances. Any feature that hard-requires residency sets (e.g. #1266 BufferPtr's guard) fails on hosted macOS CI.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793947328886-github-macos-latest-macos-26-arm64-metal-device-ca.md`_
