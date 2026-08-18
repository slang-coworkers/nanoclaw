---
title: "GitHub mergeStateStatus BLOCKED masks BEHIND — and 'merged while behind' does not prove behindness is not your gate"
type: learning
topic: agent-ops
source: learnings/1785934498121-github-mergestatestatus-blocked-masks-behind-and-m.md
---

# GitHub mergeStateStatus BLOCKED masks BEHIND — and "merged while behind" does not prove behindness is not your gate

On a PR that is `MERGEABLE` + `BLOCKED`, do not accept "it's behind base → merge base to clear it" without testing it. Measured on shader-slang/slang 2026-08-05 (PR #12186, 14 behind, all required checks green):

**1. `BLOCKED` masks `BEHIND`.** Across all 237 open PRs: 90 report `BEHIND`, 36 `BLOCKED`. GraphQL returns one status, so a PR that is *both* behind and blocked shows only `BLOCKED` ⇒ its blocker is independent of the divergence, and clearing the divergence need not change anything.

**2. Test "behind blocks merge" against merge history.** 9 of the 10 most-recently-merged PRs merged *while behind* their base — one by 42 commits. Recipe: for each merged PR take `mergeCommit.oid`, its `parents[0].sha` (= base tip at merge), then `compare/<parent0>...<headRefOid>` → `behind_by`.

**3. ⚠️ The refutation does NOT clear the requirement for a bot.** A maintainer merge can bypass protections that still bind a less-privileged actor. History proves the gate isn't *absolute*, not that it isn't in *your* blocker computation. Say the weaker thing.

**4. Unresolved review threads likewise aren't an absolute gate** here: #12344 merged with 17 unresolved, #12332 with 22.

**5. Readable protection paths when `branches/<b>/protection` 403s** ("Resource not accessible by integration" for a GitHub App token): `repos/{o}/{r}/branches/{b}` still returns a `.protection` object with the **required status check contexts**, and `repos/{o}/{r}/rules/branches/{b}` returns the **ruleset** rules. Both worked where the protection endpoint was denied — try them before declaring the rule unreadable. Neither exposes the operative merge blocker, so still don't name a cause.

**6. ⚠️ Check `baseRefName` before comparing anything to `master`.** I nearly shipped "these 2 PRs are CLEAN while 111/191 commits behind master" as my strongest evidence — both target *feature branches* and are behind=0 against their own base. A PR compared against the wrong base yields a large, confident, meaningless number.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785934498121-github-mergestatestatus-blocked-masks-behind-and-m.md`_
