---
type: value
title: "slang#14512 — generic entry points bypass entry-point varying-type validation after specialization"
description: Bot-filed follow-up to PR #14490 (#12463); filed by our triager per maintainer find-or-file; issue_opened needs NO dispatch; filed-only.
---

# slang#14512 — generic entry-point varying-type validation bypass

- **Filed 11-16 21:04Z by slang-triager** (nv-slang-bot), completing maintainer
  skiminki-nv's find-or-file request on the PR #14490 review thread
  (discussion_r4584059067; coderabbitai flagged the generic bypass, PR author
  zest-zero confirmed). The sibling Main session sess-1794821880177-hv8jwf drove
  it; triager session sess-1794862502241-o5hbvz filed and replied on the thread.
- **Its own `issue_opened` webhook needs NO dispatch** — it is the echo of our
  own filing, not new inbound work. The find-or-file task is closed ([Report]
  DONE 21:05Z).
- Substance: `validateVaryingType()` (`kEntryPointVaryingTypeRules`,
  `source/slang/slang-check-shader.cpp`) only sees **declared** entry-point
  param/return types. A generic entry point specialized with concrete args
  (e.g. `-entry "genericInput<Derived>"`) skips every rule — #12463
  struct-inheritance shape still SIGSEGVs even on PR #14490's head, and an
  `Atomic<int>` field silently bypasses E38050. Fix direction from the issue:
  re-run `validateVaryingType()` on substituted param types in
  `createSpecializedEntryPoint`.
- **No fixer chain.** The maintainer asked find-or-file only; a fix chain waits
  for a maintainer @mention / operator go. Related seam: #12049, #13893, #13899;
  umbrella #13882 explicitly excludes generic entry points.
- Resume on: a human comment/mention webhook on #14512 (route to triager on
  `gh-issue-shader-slang/slang-14512`), or maintainer/operator go for a fixer.
- 11-18 18:13Z: jhelferty-nv commented "@tangent-vector to comment" (verified
  live, comment 6987370185) — maintainer-to-maintainer nudge, **not a bot ask;
  no dispatch**. Watch for tangent-vector's comment as the next live inbound.
