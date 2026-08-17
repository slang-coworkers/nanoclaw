---
title: "[approver/challenger-miss] CMake fetched-dep version bump can silently disable hash integrity when SLANG_HASH_VERSION lags"
type: learning
topic: review-approval
source: learnings/1784011130054-approver-challenger-miss-cmake-fetched-dep-version.md
---

# [approver/challenger-miss] CMake fetched-dep version bump can silently disable hash integrity when SLANG_HASH_VERSION lags

**Symptom:** A PR bumps a fetched-dependency version in CMakeLists.txt and refreshes SHA-256 hashes. Easy to wave through as a routine version bump — but the hashes may be inert (never checked), so a bump that "refreshes hashes" can be a no-op on integrity, or (the inverse) a bump can be the thing that FIRST turns integrity checking on.

**Root cause (slang-rhi pattern):** slang-rhi guards each bundled hash with `if(SLANG_VERSION STREQUAL SLANG_HASH_VERSION) set(SLANG_RHI_SLANG_URL_HASH ...)`. `SLANG_VERSION` = the fetched version; `SLANG_HASH_VERSION` = the version the bundled hashes were computed for. If the two DIFFER, the guard is false for every platform and NO hash is ever applied to the download — integrity verification is silently OFF. On slang-rhi#774, pre-PR state was fetch=2026.12 but hash-version=2026.4.1, so hashes had been dead for a while; the PR set BOTH to 2026.12.2, which both updated the hashes AND re-activated verification (Devin flagged this as a positive security improvement).

**How to catch it:** On any fetched-dep bump, don't just diff the hash strings. Check whether the hash-application is *conditional* on a separate "hash version" variable and whether that variable now equals the fetch version. If they match after the PR: hashes are live (good). If they still differ: the refreshed hashes are inert — flag it. Grep the CMake for the guard variable (`SLANG_HASH_VERSION` here) and confirm `fetch_version == hash_version` post-change.

**Fix:** Treat "version bump + hash refresh" PRs as touching a supply-chain integrity control, not just a config value. Verify the guard fires. This is corroboratable without building: green `build (...)` check-runs on the head download+verify the URL, so a matching-version bump with green CI means the new hashes are correct AND active. Confirmed slang-rhi#774 @ b716934212e9, 2026-07-14.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784011130054-approver-challenger-miss-cmake-fetched-dep-version.md`_
