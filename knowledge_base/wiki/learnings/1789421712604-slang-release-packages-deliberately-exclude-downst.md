---
title: "Slang release packages deliberately exclude downstream compiler binaries (DXC/DXIL)"
type: learning
topic: slang-compiler
source: learnings/1789421712604-slang-release-packages-deliberately-exclude-downst.md
---

# Slang release packages deliberately exclude downstream compiler binaries (DXC/DXIL)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789128098218-tr1r9g
written_at: 2026-09-14T21:35:12.604Z
---

# Slang release packages deliberately exclude downstream compiler binaries (DXC/DXIL)

# Policy: Slang releases do not bundle downstream compilers

**Established by maintainer decision on shader-slang/slang#13007 (closed Not-Planned, 2026-09-14, by jkwak-work).** The reporter explicitly noted "I could not find a ticket that records why" — this is now the authoritative record.

## The policy
Slang release packages **deliberately exclude all downstream compiler binaries** — not just DXC (`dxcompiler`/`dxil`), but every downstream compiler. Consequence: `-target dxil` does not work out-of-box from a release package; users must supply their own DXC (download from Microsoft, `dlopen` by bare name works, or `-dxc-path` override).

## The maintainer's stated reasons (jkwak-work)
1. **License implications** — the main reason. DXC itself may be pervasive, but DXIL-related implementations rest on a lot of proprietary technology; maintainers are not familiar with the legal implications and prefer to avoid the trouble entirely by not shipping any downstream binaries.
2. This policy applies to **all** downstream compilers, not only DXC.
3. Avoid increasing release-package **binary size** by bundling downstream compilers.

## Alternative the maintainer offered
Print a URL to the DXC prebuilt binaries to make downloading easier when needed (not implemented as of this decision; would be a small enhancement if someone picks it up).

## Note on the source-vs-prebuilt argument
The reporter argued the licensing concern applies only to Microsoft's **prebuilt** archives (which carry `LICENSE-MS.txt`), not to DXC built **from source** at Slang's pinned commit `21d28f727ad395b59394815ef76012e432f7e4e5` (only permissive UIUC/NCSA `LICENSE.TXT`), and noted `SLANG_DXC_BUILD_FROM_SOURCE` already produces a source-built artifact in CI (macOS builds it by default). This distinction did **not** change the outcome — maintainers chose to avoid the legal uncertainty entirely regardless of build source.

## Triage guidance for future similar requests
Requests to "bundle DXC / a downstream compiler in Slang releases" are **direction+licensing-gated maintainer policy calls** — do NOT auto-dispatch a fixer for a speculative PR. This one was closed Not-Planned. The mechanical implementation itself (CMake `install()`/CPack rules in `cmake/FetchDXC.cmake`, `cmake/FetchedSharedLibrary.cmake:install_fetched_shared_library`, `release.yml`) is a <1hr change if ever green-lit, but the gate is policy, not engineering.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789421712604-slang-release-packages-deliberately-exclude-downst.md`_
