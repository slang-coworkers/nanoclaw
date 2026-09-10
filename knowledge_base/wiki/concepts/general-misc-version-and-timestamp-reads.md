---
title: "Version and Timestamp Reads: Dates, Pins, and Provenance at the Right Revision"
type: concept
group: general-misc
tags: [git, submodules, versions, provenance, timestamps, history-probe, github, release]
source_count: 0
---

# Version and Timestamp Reads: Dates, Pins, and Provenance at the Right Revision

## TL;DR

- Before telling a reporter "already fixed on main, please update," verify their stated release
  **actually predates the fix commit**: map the release tag to its `gh release view <tag> --json publishedAt`
  and compare against the fix's merge date. Telling someone to update when they already run a build
  that includes the fix makes them dismiss a real, unrefuted bug.
- A git submodule's **pinned commit date is NOT the dependency version.** Read the version header
  at the pinned SHA (`IMGUI_VERSION`, `VK_HEADER_VERSION`, etc.) to state the true version.
- `gh api repos/OWNER/REPO/commits/<sha>` resolves **any object reachable in the fork network** —
  including downstream patch commits not on `master`. Check reachability from the tracked branch with
  `gh api .../compare/<pin>...master --jq '{status,ahead_by,behind_by}'`.
- **Read the pin from the committed gitlink, not the working tree.** A read-only clone's submodule
  working tree can be checked out at a different commit than the superproject gitlink records; reading
  a version-pinned file from that stale tree fabricates the version number.
- Detect a drifted submodule: `git submodule status` prefixes `+` when checked-out ≠ recorded;
  compare `git ls-tree HEAD external/<sub>` (gitlink) vs `git -C external/<sub> rev-parse HEAD`
  (working tree). Fix with `git submodule update --checkout external/<sub>` before reading any
  version-pinned file.
- A standing "fetch / reset --hard origin/master" directive refreshes the **superproject only** — it
  does NOT re-sync submodule working trees. Add `git submodule update --recursive` after any reset for
  submodule-touching analysis.
- When a version-dependent conclusion (symbol availability, API compat) rides on a pin, **cross-check
  against a real build** before posting it to a maintainer.
- A "when was this introduced?" history probe **needs a read-proving control**: an empty `git show`
  and an absent construct both yield `grep -c 0` indistinguishably. Pair every ref probe with
  `git show <ref>:<path> | wc -c`.
- Learn the historical file name from `git ls-tree -r --name-only <ref>` before concluding — a file
  may have lived under a different name (`parser.cpp` vs `slang-parser.cpp`), and probing a
  nonexistent tag also yields `0`.
- Neither `git log -L` nor `git log -S`/`--follow` reliably dates a change once lines have drifted or
  a file has moved; bisect the **content** across tags with a byte-count control instead.
- **Prove the harness CAN fail before recording a pass** — an isolation matrix where every row
  (baseline control included) fails carries zero information while reading like a dramatic finding.
- `slangc -v` is **not** proof of what a binary contains: the version string is baked at **configure
  time** by `cmake/GitVersion.cmake`, so it can print a real but *ancestor* commit. Verify freshness
  from the object file's mtime against the HEAD commit date.
- Keep a claim's **kind** intact: "has existed since 2017" (established by presence at old tags) must
  not be upgraded into "was introduced deliberately for reason X."
- The wiki copy of a learning is **not** byte-identical to its siblings (frontmatter + footer differ)
  — diff before mirroring; a blind `cp` across "mirrored copies" destroys metadata.
- Measure a correction's blast radius rather than trusting the count stated in the request.

## Release dates versus fix containment

When triaging a "this is already fixed on main, please update" response, verify the reporter's stated
release version **actually predates the fix commit** before telling them to update. Map the release
tag → `gh release view <tag> --json publishedAt` and compare against the fix's merge date. Telling a
reporter to update when they are already on a build that includes the fix causes them to dismiss the
issue — potentially closing a real, unrefuted bug. ([Verify reporter's release actually predates the fix before telling them to update](../learnings/1781251548493-verify-reporter-s-release-actually-predates-the-fi.md))

## Submodule pins: commit date is not the version, and read from the gitlink

When investigating a git submodule's pinned commit, ⚠️ **do not trust the commit date as a proxy for
the dependency version.** Use `gh api repos/OWNER/REPO/commits/<sha>` cautiously — it resolves *any*
object reachable in the fork network, including downstream patch commits not on `master`. To state the
true version, read the version header at the pinned SHA (`IMGUI_VERSION`, etc.). To check reachability
from the tracked branch, use `gh api .../compare/<pin>...master --jq '{status,ahead_by,behind_by}'`.
([Reading a submodule pin: commit date ≠ version; check reachability with compare](../learnings/1782231360603-reading-a-submodule-pin-commit-date-version-check-.md))

⛔ **Read the pin from the committed gitlink, not the working tree.** A read-only specialist clone can
have a submodule whose *working tree is checked out at a different commit than the superproject gitlink
records* — and reading a version-pinned file from that stale tree fabricates the version number. On
slang#11985 the `external/slang-rhi` working tree (`687dc18`, pins Vulkan-Headers v1.4.318) was ahead
of the recorded gitlink (`29dc332`, pins v1.4.347); the wrong `318` reached a triage memo and a
maintainer-facing GitHub comment and had to be retracted. The ~30-version gap *flipped the
conclusion*: at 347, slang-rhi's Vulkan backend uses symbols (`VK_EXT_SHADER_FLOAT8_EXTENSION_NAME`,
`VK_KHR_SHADER_BFLOAT16_EXTENSION_NAME`) absent from the vendored `external/vulkan`
(`VK_HEADER_VERSION 307`), so the "redirect to vendored headers, it's a no-op" fix actually breaks the
build and the network fetch is load-bearing.

✅ **Detection:** `git submodule status` prefixes a `+` when the checked-out commit differs from the
recorded one; compare `git ls-tree HEAD external/<sub>` (gitlink) vs
`git -C external/<sub> rev-parse HEAD` (working tree). **Fix:**
`git submodule update --checkout external/<sub>` before reading any version-pinned file — critically,
a standing "fetch / reset --hard origin/master; analyze against latest upstream" directive refreshes
the *superproject* but does NOT re-sync submodule working trees, so add
`git submodule update --recursive` after the reset for any submodule-touching analysis. When a
version-dependent conclusion (symbol availability, API compat) rides on the pin, cross-check against a
real build before posting it to a maintainer. ([slang read-only clone: verify submodule is at gitlink before citing pinned versions](../learnings/1783621027588-slang-read-only-clone-verify-submodule-is-at-gitli.md), [Verify submodule pins at the gitlink, not the working tree](../learnings/1783621079268-verify-submodule-pins-at-the-gitlink-not-the-worki.md))

## History probes: dating "when was this introduced?" needs read-proving controls

An empty `git show` and an absent construct both produce `grep -c 0`, so a "when was this introduced?"
answer needs a **read-proving control.** Correcting a false provenance claim (a Slang parser fence
dated to a specific PR) surfaced four instrument traps:

1. **The false negatives came from probing refs that *could not answer*** — a tag that **does not
   exist**, and a commit where the file lived under a **different historical name** (`parser.cpp`, not
   `slang-parser.cpp`) — both yielded `0` indistinguishably from "the gate is absent." Pair every ref
   probe with a read-proving control (`git show <ref>:<path> | wc -c`) and learn the historical name
   from `git ls-tree -r --name-only <ref>` before concluding.
2. ⚠️ **Neither `git log -L` nor `git log -S` dates a change once lines have drifted or a file has
   moved** — `-L` landed on a 2024-11 formatting commit, `-S`/`--follow` on a 2019 rename; bisect the
   *content* across tags with a byte-count control instead.
3. **Prove the harness can fail before recording a pass** — an isolation matrix where *every* row
   fails, baseline control included, carries zero information while reading like a dramatic finding.
4. ⛔ **`slangc -v` is not proof of what a binary contains** — the version string is baked at
   *configure* time by `cmake/GitVersion.cmake`, so it printed a real but *ancestor* commit; verify
   freshness from the object file's mtime against the HEAD commit date.

The corrected answer also inverted the claim's *kind*: the fence is in the 2017 initial import,
present at `v0.5.3` and `v2024.0.0`, so "has existed since 2017" is established while "was introduced
deliberately for reason X" is **not** — the former must not be upgraded into the latter. Two mirroring
lessons ride along: the wiki copy of a learning is **not** byte-identical to its siblings (frontmatter
+ footer), so a blind `cp` across "three mirrored copies" destroys metadata — **diff before
mirroring**; and a correction's blast radius must be *measured* rather than taken from the count in the
request. ([four history-probe traps from a provenance correction](../learnings/1785828813360-correction-generic-arg-fence-dates-to-the-2017-ini.md))

**Source learnings (5):**
- [Verify reporter's release actually predates the fix before telling them to update](../learnings/1781251548493-verify-reporter-s-release-actually-predates-the-fi.md) — release publish date vs fix merge date before saying "just update"
- [Reading a submodule pin: commit date ≠ version; check reachability with compare](../learnings/1782231360603-reading-a-submodule-pin-commit-date-version-check-.md) — commit date is not the version; use the version header + `compare` for reachability
- [slang read-only clone: verify submodule is at gitlink before citing pinned versions](../learnings/1783621027588-slang-read-only-clone-verify-submodule-is-at-gitli.md) — a stale submodule working tree fabricates the pinned version
- [Verify submodule pins at the gitlink, not the working tree](../learnings/1783621079268-verify-submodule-pins-at-the-gitlink-not-the-worki.md) — detect drift with `git submodule status` / `ls-tree`; `update --recursive` after any reset
- [four history-probe traps from a provenance correction](../learnings/1785828813360-correction-generic-arg-fence-dates-to-the-2017-ini.md) — read-proving controls, `log -L`/`-S` drift, harness-can-fail, `slangc -v` baked at configure time
