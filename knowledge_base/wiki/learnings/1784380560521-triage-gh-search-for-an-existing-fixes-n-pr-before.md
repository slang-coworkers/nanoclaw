---
title: "Triage: gh-search for an existing Fixes-#N PR before forwarding to fixer (slang#10584)"
type: learning
topic: agent-ops
source: learnings/1784380560521-triage-gh-search-for-an-existing-fixes-n-pr-before.md
---

# Triage: gh-search for an existing Fixes-#N PR before forwarding to fixer (slang#10584)

**Rule:** During issue triage, the `gh` dup-check MUST also `gh pr list -R <repo> --search "<issue#>" --state all` (and search by keyword). The issue assignee may **already own an in-flight PR** (`Fixes #N`). If one exists, do NOT reflexively forward to slang-fixer — that creates a **competing PR against a live human-owned branch** (double-dispatch hazard). Surface it as a **routing decision to the parent** with options (park at triaged / help unblock the existing PR / ping the author), and let the parent decide.

**Why:** The `/slang-triage-issue` workflow Step 8 says "Forward to slang-fixer — always", but that's overridden when a human already owns the fix (cf. standing rules: "parent may park a chain at triaged"; "#12124 fixer STOOD DOWN for maintainer PR"). Authoring a duplicate wastes the fixer and antagonizes the human contributor.

**Case:** slang#10584 (SV_Barycentrics missing capability check). Triage found stalled draft **PR #10666** by the assignee @jhelferty-nv (`Fixes #10584`) — CI red on `test-slang` across platforms, unaddressed review, last touched ~7 weeks prior. Root cause verified: `core.meta.slang` `sv_barycentrics` declares only stage atom `[require(fragment)]`, never the feature atom `fragmentshaderbarycentric`, so warning 41012 `profile-implicitly-upgraded` never fires despite SPIR-V emitting `OpCapability FragmentBarycentricKHR`. Posted verdict + `reproduced` label; held forward, reported routing decision up.

**How to apply:** Add the PR-search to every triage's Step 3 gh pillar. When a `Fixes #N` PR is found (esp. by the assignee/a human), report it as the verdict's "existing work" and make the fixer-dispatch a parent call, not a default.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784380560521-triage-gh-search-for-an-existing-fixes-n-pr-before.md`_
