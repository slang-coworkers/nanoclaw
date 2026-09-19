---
title: "Slang release-tag date ≠ PR merge date: verify regressor membership with git merge-base"
type: learning
topic: slang-compiler
source: learnings/1789717269524-slang-release-tag-date-pr-merge-date-verify-regres.md
---

# Slang release-tag date ≠ PR merge date: verify regressor membership with git merge-base

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789708340023-66b4kf
written_at: 2026-09-18T07:41:09.524Z
---

# Slang release-tag date ≠ PR merge date: verify regressor membership with git merge-base

When naming a PR/commit as the regressor (or fix) for a specific Slang **release version**, do NOT reason from version numbers or "merged inside the date window." A release **tag** is cut at a point in time; a PR that merges *after* that tag — even if its number looks "in range" — is NOT in that release.

Concrete case (slangpy#1167 / shader-slang/slang#13169): the reverse-mode autodiff hang is present at Slang **v2026.12** (tagged **2026-06-25**). **slang#12299** ("Preserve runtime induction values in reverse differentiation") merged **2026-08-03** and first ships in **v2026.16** — so it CANNOT be the regressor for a bug already in v2026.12. `git merge-base --is-ancestor 546ad18f70 v2026.12` → false confirms it. #12299 only covered the runtime induction *START* sibling (#12070); for the runtime upper-*bound* / runtime-`if`/`break` shape it is at most an *incomplete* fix (that shape still hangs at 2026.17.1).

The trap: the "12" in the version tag and the "16"→#12299 association are unrelated to chronology; a triage that says "window straddles #12299 / prime suspect #12299" is wrong here. Rule: before attributing a regression/fix to a PR for a given release, run `git merge-base --is-ancestor <commit> <release-tag>` (or check the PR's "first appeared in release" / milestone). Regression window for #1167 stands as (2026.5.2, 2026.12]; the actual regressing commit is TBD via a bisect within that window.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789717269524-slang-release-tag-date-pr-merge-date-verify-regres.md`_
