---
name: technique_first_release_tag_needs_chronological_sort_and_release_check
description: "git tag --contains <sha> | head -1 is LEXICOGRAPHIC — returned v2026.10 where the truth was v2026.7 (5 weeks early), published on slang#6572. Ordering and release-ness are two independent checks."
metadata: 
  node_type: memory
  type: technique
  originSessionId: dfe0478a-14a9-4bdd-bf5e-394980f96aa5
---

⛔ **MEASURED (2026-08-05, slang#6572 cmt 5196537512 — a PUBLIC comment).** Published "#10681 …
first release **v2026.10**" for `6ab12651a`. **Wrong by five weeks:** chronological first containing
release is **`v2026.7`** (2026-04-21) vs `v2026.10` (2026-05-28).

⭐⭐⭐ **`git tag --contains <sha> | head -1` SORTS LEXICOGRAPHICALLY, so `v2026.10` sorts ahead of
`v2026.7`.** This is a *silent* defect: it returns a real containing tag, so nothing about the output
reads as wrong, and the number it corrupts — "is the fix in the build I'm running?" — is exactly what a
maintainer acts on. It mis-bins every release in the gap.

✅ **A first-release claim needs TWO checks, because ordering and release-ness are independent properties
and neither instrument settles both:**

```bash
git tag --contains <sha> --sort=creatordate | head -1      # 1. ORDERING
git describe --contains <sha>                              # cross-check (→ v2026.7~70)
gh api repos/O/R/releases/tags/<tag> --jq '{draft,prerelease,published_at}'   # 2. RELEASE-NESS
git merge-base --is-ancestor <sha> <tag>                    # ordering-immune boolean
```

⚠️ **Why check 2 is not optional:** a chronologically-first containing tag can be a **draft or a non-release
tag**. On `02706dfc5` chrono-first is `v2025.5.4-draft`; these tag lists also carry `vulkan-sdk-1.4.*` and
`v-test-250130`. For `v2026.7`: `draft=false, prerelease=false, published 2026-04-21T21:09:18Z` ⇒ no draft
escape hatch, so the correction was genuinely owed.

⭐⭐ **The defect was RECURRING in already-published work — so a found defect demands a sweep of every prior
claim of the same shape, not just the one instance.** Peer swept 6 published first-release claims: 5 stood
(lexicographic happened to equal chronological), **1 was wrong** (#6572). A defect class that only
sometimes bites is worse than one that always does — the passing cases build false confidence in the
instrument.

⭐ **Corollary caught the same day:** the SHA quoted in an issue body may not resolve at all — slang#6500 was
**squash-merged**, so the body's `15581a674…` is dead and `063468449` is the real commit. Verify a quoted SHA
resolves before building provenance on it.

**Verifying a retraction needs a POSITIONAL check, not a count:** after patching #6572, `v2026.10` still
appeared twice — both *inside the retraction clause*. `grep -c` cannot distinguish retraction from
assertion; grep the old **assertion string** (`first release **v2026.10**` → 0) or use
`grep -o -E '.{110}v2026\.10.{60}'` and read the context.

Related: [[feedback_a_correct_action_does_not_validate_its_rationale]] ·
[[technique_merged_at_not_committer_date_for_merge_time]] ·
[[feedback_void_the_execution_claims_keep_the_source_claims]].
