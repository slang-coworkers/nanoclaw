---
title: "Slang #12302 BSD-notice fix: bare LICENSES/BSD-*.txt breaks reuse lint (unused-license)"
type: learning
topic: slang-compiler
source: learnings/1785460805646-slang-12302-bsd-notice-fix-bare-licenses-bsd-txt-b.md
---

# Slang #12302 BSD-notice fix: bare LICENSES/BSD-*.txt breaks reuse lint (unused-license)

**Refinement on the triage's Approach A for shader-slang/slang#12302** (verified @ HEAD dc9558d57c + REUSE spec 3.3, 2026-07-31).

The triage memo's Approach A says literally "add `LICENSES/BSD-2-Clause.txt` + `LICENSES/BSD-3-Clause.txt`". **Done that way alone it turns the `reuse lint` CI job RED.** Two things get conflated:

- **REUSE spec 3.3 (verified):** "A Project MUST NOT include License Files for licenses under which none of the files in the Project are licensed." `.github/workflows/reuse-compliance.yml` runs `fsfe/reuse-action@v6` on `actions/checkout@v7` with **no `submodules:` key** (default `false`) → submodule internals are never scanned. So no *tracked* superproject file carries `SPDX-License-Identifier: BSD-2-Clause`/`BSD-3-Clause`, and the two new `LICENSES/` files are **unused → non-compliant**. You canNOT fix this by annotating `external/cmark/**` in `REUSE.toml` — submodule files aren't tracked files of the superproject, so the annotation matches zero files.
- **What BSD actually requires** is reproducing the dep's **copyright notice** ("Copyright (c) 2014, John MacFarlane" etc.) in binary redistribution. An SPDX *license-text* template contains the license TERMS, not the copyright line — so a bare SPDX template satisfies neither the license nor REUSE.

**Correct fix shape:** ship the deps' OWN notice files (`external/cmark/COPYING`, `external/lz4/lib/LICENSE`, `external/glslang/LICENSE.txt` — these carry both the copyright line and terms) via the install metadata component, independent of the REUSE `LICENSES/` mechanism (Approach A1). Only add `LICENSES/BSD-*.txt` if you ALSO make them "used" by annotating a real TRACKED carrier file (e.g. the installed THIRD-PARTY-NOTICES file, or a tracked manifest) with the matching SPDX id in REUSE.toml (Approach A2).

**Also:** cmark's `external/cmark/COPYING` is COMPOUND — BSD-2-Clause + several embedded MIT sub-notices (houdini*, scanners). Shipping its own COPYING covers all of them; a single `BSD-2-Clause.txt` template would not.

This is a legal/maintainer-policy call → draft PR only, hold for direction.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785460805646-slang-12302-bsd-notice-fix-bare-licenses-bsd-txt-b.md`_
