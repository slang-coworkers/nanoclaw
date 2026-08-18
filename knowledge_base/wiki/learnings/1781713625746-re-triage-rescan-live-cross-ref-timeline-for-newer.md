---
title: "Re-triage: rescan live cross-ref timeline for newer maintainer PRs touching the issue's files"
type: learning
topic: agent-ops
source: learnings/1781713625746-re-triage-rescan-live-cross-ref-timeline-for-newer.md
---

# Re-triage: rescan live cross-ref timeline for newer maintainer PRs touching the issue's files

When re-triaging an issue you (the bot) previously triaged, the disposition can have flipped since the last pass — a maintainer may have opened a PR that touches the issue's files under a *different* `Closes #` link, so it won't show up in a naive "Closes #<thisissue>" search.

**Concrete case (slang #11479, 2026-06-17):** issue #11479 (bot-authored) tracked a committed-broken test `tests/diagnostics/pragma-warning-multifile-*` and asked a maintainer call: (A) editorial fix (drop push/pop from impl1 so the bare disable leaks into impl2) vs (B) cross-`__include` persistence as a feature. The bot's earlier triage strongly recommended (A). But by the time jkwak asked "which PR is directly for this issue, make one if none," maintainer @expipiplus1's **open PR #11554 (`Closes #11473`, NOT #11479)** already modified the exact test files — flipping `main.slang` from `// CHECK-NOT: warning 30856` to `// CHECK: warning[E30856]`, keeping impl1's push/pop, and citing #11479 in new comments as the tracker for the *remaining* design question. i.e. #11554 silently resolved the broken-test symptom in the **opposite** (standard-scoping) direction from the old (A) recommendation, leaving #11479 as a pure (B) design tracker.

**How I found it:** `gh api repos/.../issues/<n>/timeline --jq '.[]|select(.event=="cross-referenced")...'` surfaced #11554; `gh pr view 11554 --json files` showed it touched the issue's test files even though its body never mentions #11479. A naive `--search "11479"` PR search returned nothing.

**Lessons:**
1. Always run the cross-reference timeline + per-PR `files` check, not just a keyword/Closes search — a PR can address an issue's artifacts under another issue's close-link.
2. When a maintainer's own PR already touches the files, do NOT auto-fire the fixer to open a competing PR (reinforces the prior "confirm direction, don't assume" learning). Opening an (A) PR would have directly conflicted with #11554's (B-deferring, standard-scoping) direction. Surface #11554, recommend, and pose the keep-open-for-B vs close-on-merge decision to the maintainer.
3. Stale prebuilt binaries lie: `build/Debug/bin/slangc -v` reported `2026.10.2-33-g5230a81f2` ≠ current HEAD; its test PASS contradicted both the issue premise and #11554's CI expectation. Check the binary's commit before trusting a local repro; rely on PR metadata (authoritative) when a rebuild isn't worth it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781713625746-re-triage-rescan-live-cross-ref-timeline-for-newer.md`_
