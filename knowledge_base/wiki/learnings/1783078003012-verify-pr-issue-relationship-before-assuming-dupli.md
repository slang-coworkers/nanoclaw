---
title: "Verify PR-issue relationship before assuming duplicate — accept-now/fix-later splits (slang #11938 vs #11937)"
type: learning
topic: slang-compiler
source: learnings/1783078003012-verify-pr-issue-relationship-before-assuming-dupli.md
---

# Verify PR-issue relationship before assuming duplicate — accept-now/fix-later splits (slang #11938 vs #11937)

When triaging a leak/sanitizer/hardening issue, an open PR that mentions the issue number is NOT automatically its fix. Sanitizer-burndown work is often split into two PRs by the same author: an **accept-now** PR that adds a `LEAK:`/finding line to `cmake/expected-sanitizer-findings.txt` (referencing a freshly-filed tracking issue) plus fixes for *adjacent* leaks, and a later **fix** that the tracking issue tracks.

Concrete case (2026-07-03): slang #11938 = "repro load leaks `CacheFileSystem::PathInfo` without unique identity". PR #11937 (same author, open) referenced #11938 but only (1) ADDED `LEAK: getPathInfoFromFile` to the findings file referencing #11938, and (2) fixed the *adjacent* `SourceFile` leak in the same call chain (`getSourceFile`: `new SourceFile`→`createSourceFileWithBlob`) + a preprocessor leak. It did NOT touch the PathInfo allocation (line 713) or the skip (`continue` at slang-repro.cpp:1157-1159). Two different objects allocated in the same `getSourceFile`→`getPathInfoFromFile` chain. #11938 is the deliberately-deferred follow-up.

How I caught it: `gh api pulls/<n>/files --jq '.[].patch'` on the referencing PR — read the actual diff of the shared file, don't trust the "Fixes/references #N" mention or the PR title. Also: the issue said the leak was "accepted in expected-sanitizer-findings.txt", but that line was NOT at HEAD — because the accept-PR hadn't merged yet. A findings-file entry the issue *claims exists* may only exist in the in-flight PR.

Triage consequences: (a) don't mark as duplicate; (b) the real fix is STACKED behind the accept-PR (must merge first, then the fix removes the accepted line to avoid conflict + keep the stale-pattern CI warning clean); (c) when the issue author is actively driving the burndown and split the leak into its own tracking issue, that's a strong "author owns the follow-up" signal → recommend PARKing the fixer dispatch rather than opening a competing draft that conflicts on the exact findings-file line.

Root-cause lens that generalized: a memory leak where "some entries have no unique identity" was NOT a producer bug — `CacheFileSystem` conflates *ownership* with the *unique-identity lookup map* (`m_uniqueIdentityMap` is the sole owner; `~CacheFileSystem`/`clearCache` free only it). Identity-less entries are a legitimate shape (in-memory sources, made intentionally by the store side). Principled fix = ownership independent of lookup (owned `List<PathInfo*>`), not fabricating an identity to satisfy the owner-map shortcut.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783078003012-verify-pr-issue-relationship-before-assuming-dupli.md`_
