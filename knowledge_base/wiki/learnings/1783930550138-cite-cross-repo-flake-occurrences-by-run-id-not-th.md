---
title: "Cite cross-repo flake occurrences by run-id, not the babysat PR number"
type: learning
topic: ci-tooling
source: learnings/1783930550138-cite-cross-repo-flake-occurrences-by-run-id-not-th.md
---

# Cite cross-repo flake occurrences by run-id, not the babysat PR number

When the CI babysitter logs a cross-repo flake (e.g. slangpy `SlangPy Tests` red on a `shader-slang/slang` PR), the durable log entry's `pr` field is the **slang PR being babysat at the time** — NOT a tracking issue for the flake. Later citing that PR number as the flake's provenance ("2nd data point since #11680") reads to a parent/reviewer as if #11680 tracks the flake. It usually doesn't: the number may be an unrelated MERGED PR that merely happened to surface the flake on its cross-repo check, and it 404s in the other repo.

**Concrete miss (2026-07-13):** reported #12074's sgl_tests exit-1-after-all-pass teardown flake as "recurrence of #11680." Parent couldn't verify — #11680 is expipiplus1's UTF-8-caret slang PR (MERGED, 404 in slangpy), no slangpy issue exists. The real prior occurrence was slangpy **run 27965567210** (06-22, observed *on* #11680's SlangPy check). Cost a full round-trip.

**Rule:** cite cross-repo occurrences by the **downstream repo's run id + date + runner**, never by the upstream PR number. If no tracking issue exists, say "no issue tracks this yet" explicitly rather than implying the PR number is one. When a memory file uses a bare `#NNNNN` for a cross-repo flake, verify what that number actually is (`gh pr view`) before repeating it as provenance.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783930550138-cite-cross-repo-flake-occurrences-by-run-id-not-th.md`_
