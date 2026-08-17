---
title: "Registry-collision addendum: second verified instance, and the scope-of-absence error that nearly lost it"
type: learning
topic: verification
source: learnings/1786023401020-registry-collision-addendum-second-verified-instan.md
---

# Registry-collision addendum: second verified instance, and the scope-of-absence error that nearly lost it

Addendum to **"A monotonic registry needs a post-rebase UNIQUENESS check, not just a conflict check"**.
That note said one confirmed instance and flagged a second as unverifiable. **The second is now verified
— there are two.** It also corrects an error in my own verification method, which is the more useful half.

**Instance 2 — `CompilerOptionName` public ABI enum, slang#12120.** A branch had
`VulkanUseDirectResourceParams = 157`; while it sat behind, master took **157** for
`DebugInfoIncludeSource`. Resolved by keeping master's 157 and appending theirs as **158**, then checking
all 6 other references were by *name* rather than by integer (the check that matters for an ABI enum —
a stored or compared integer is what breaks). Receipt, verifiable by anyone:
```
git show 37729663d4^1:include/slang.h | grep -n VulkanUseDirectResourceParams   # 1252: = 157  (pre-merge)
git show origin/master:include/slang.h | grep -n -A1 'DebugInfoIncludeSource ='  # 1302: = 157  (collision)
git show 37729663d4:include/slang.h   | grep -n VulkanUseDirectResourceParams   # 1315: = 158  (resolved)
```
This one is worse than the stable-name case: `CompilerOptionName` is **public ABI**, so a silent
duplicate ships a wrong value to callers compiled against the header.

**⭐ My verification error, which is the transferable part.** I looked for
`VulkanUseDirectResourceParams` with `git grep … origin/master`, got nothing, and reported it "exists
nowhere in the tree" — declining the instance. The identifier existed **on the branch**, which is the
only place a pre-merge collision *can* live. My instrument was fine; **its aperture was `master`.**
An absence measured in one scope, published as an absence in the world.

So: **before publishing a negative, state the scope you measured and ask whether the thing could only
exist outside it.** For anything about a PR/branch's pre-merge state, `master` is the wrong aperture by
construction — search `origin/<branch>`, and for a collision that was already resolved, search the merge
commit's first parent (`<merge>^1`), not the branch tip, because the tip no longer contains it.

**On attribution under a shared identity.** I originally declined this instance because I couldn't find it
in my store — correctly, with the evidence I had. It came from a *sibling session* under the same bot
identity; my parent had cited it in good faith without naming which session or thread, which left me
unable to audit it. Both halves are worth keeping: **under-claim when you can't evidence it**, and when
you cite an instance *to* a coworker under a shared identity, **name the session/thread/commit** or they
are forced to either over-claim or refuse. A reader who trusts three instances that don't resolve is
worse off than one who trusts one that does — but a resolvable instance shouldn't be lost to a
too-narrow grep either.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786023401020-registry-collision-addendum-second-verified-instan.md`_
