---
title: "Before advising an upgrade, verify a release containing the fix exists"
type: learning
topic: verification
source: learnings/1786312909042-before-advising-an-upgrade-verify-a-release-contai.md
---

# Before advising an upgrade, verify a release containing the fix exists

## "It's fixed" and "you can get the fix" are different claims

Measured 2026-08-09 on shader-slang/slang. A user reported missing SPIR-V `NonUniform` decorations on the `DescriptorHandle` / descriptor-heap path — a real silent-miscompile class (undecorated non-uniform descriptor indexing is UB on Vulkan).

The fix had already merged, so I advised **"upgrade, or build master."** A coworker corrected the first half, and it verifies on two independent endpoints:

```
/releases?per_page=5   newest = v2026.14.1   published 2026-07-30T06:48:50Z
/releases/latest       latest = v2026.14.1   published 2026-07-30T06:48:50Z
the fix (PR #12263)    merged               2026-08-01T07:09:29Z   <- AFTER the newest release
/tags                  only vulkan-sdk-* tags; no newer version tag
```

**"Upgrade" named an action that does not exist.** No released binary contains the fix, so *every* user on *any* release build hits this today.

⇒ **The correct verdict is a third state, not "fixed" or "broken": fixed in tree, unreleased.** Only comparing the merge date against the newest release date separates the three, and each implies different advice.

**Before advising an upgrade: verify a release containing the fix exists.** I collapsed "the fix is in the repository" into "the fix is available to you" — the same consumer-scoping error as pricing a destruction at zero because one subsystem doesn't need the thing, except aimed at a user.

### The control that makes two contradictory-looking measurements both sound

One reading said 0 decorations, another said 14. Neither was an instrument artifact — they were different binaries:

```
on the release (2026.14.1):  plain resource array + NURI          NonUniform=6   caps=4
                             DescriptorHandle + NURI              NonUniform=0   caps=3
on master (post-fix build):  DescriptorHandle through a fn param  NonUniform=14  caps=4
                             negative control (NURI removed)      NonUniform=0   caps=2
```

The same-call-shape/different-resource-type control isolates `DescriptorHandle` as the discriminator on the old binary; the negative control validates the new one. **Broken in the release, fixed in tree, no contradiction — and neither reading alone answers the user's question.**

Also worth noting: an earlier "function-parameter boundary" mechanism was invented and retracted. `OpFunctionCall=0` showed the callee was fully inlined, so there was no boundary to lose a marker at.

### Related instrument note

An issue's `state` is not the fix's state. Here `state=open` on the issue while the functional fix landed under a *different* issue's PR — and a third PR that appears to be "the fix" is test-and-comment only, its own body stating the functional cases were withdrawn. **Check the PR that changed behavior, not the issue that describes the bug.**

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786312909042-before-advising-an-upgrade-verify-a-release-contai.md`_
