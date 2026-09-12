---
title: "Third-party license-notice follow-ups: Apache §4(d) NOTICE precondition + sequence behind the unmerged precedent PR + bot workflows-permission wall"
type: learning
topic: misc
source: learnings/1789167340037-third-party-license-notice-follow-ups-apache-4-d-n.md
---

# Third-party license-notice follow-ups: Apache §4(d) NOTICE precondition + sequence behind the unmerged precedent PR + bot workflows-permission wall

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789166818398-bhhzmo
written_at: 2026-09-11T22:55:40.037Z
---

# Third-party license-notice follow-ups: Apache §4(d) NOTICE precondition + sequence behind the unmerged precedent PR + bot workflows-permission wall

Triaging shader-slang/slang#13023 (MIT/Apache notice follow-up to #12302/#13021), three reusable facts:

1. **Apache-2.0 §4(d) NOTICE-carry only triggers if the upstream Work actually contains a NOTICE file.** A dep can be Apache-2.0 yet ship no NOTICE (e.g. `external/spirv-tools` has `LICENSE`, no `NOTICE`). In that case the obligation is only LICENSE text + attribution retention, NOT a NOTICE-carry duty. Don't assert "Apache ⇒ must carry NOTICE" without checking the dep tree for an actual NOTICE file. (Verify: `ls external/<dep>/NOTICE`.)

2. **Header-only vs compiled-in changes the redistribution argument.** `fast_float` is header-only but its `from_chars` is compiled into the shipped binary (float parsing in slang-lexer) → notice clause plausibly applies. `spirv-headers` is an INTERFACE target consumed as headers + build-time grammar JSON → NO compiled code in the binary → weakest "substantial portions" case. Whether a header-only dep triggers the clause is a maintainer/legal scope call, not a code decision — flag it, don't decide it.

3. **Sequence a notice follow-up behind its still-open precedent PR, and expect a workflows-permission wall.** #13021 (the BSD-trio precedent) was still an UNMERGED draft with an open maintainer structural pick (per-dep notice files vs one aggregated `THIRD-PARTY-NOTICES`). A follow-up that adds `install(FILES ...)` rules to the SAME CPack `metadata` block must (a) land AFTER the precedent to avoid a merge conflict, and (b) adopt the same per-dep-vs-aggregated form for consistency — so it's gated on the precedent's resolution, not independently dispatchable. Also: the nv-slang-bot GitHub App token CANNOT push `.github/workflows/*` (missing `workflows` permission), so the WASM-package (`release.yml`) and CI-coverage (`ci-*.yml`) halves of any packaging fix must be delivered as a maintainer-applied `git apply` patch, not a bot commit. This recurs for every release/packaging/CI change.

Packaging has TWO edit sites (confirmed again): CPack `metadata` component in root `CMakeLists.txt` (platform ZIP/TGZ) AND the hand-assembled WASM packages in `release.yml` which `cp` `LICENSES/` and bypass CPack (`exit 0` before cpack). Fixing package contents requires both.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789167340037-third-party-license-notice-follow-ups-apache-4-d-n.md`_
