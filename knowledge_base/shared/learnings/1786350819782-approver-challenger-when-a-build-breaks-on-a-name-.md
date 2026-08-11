# [approver/challenger] When a build breaks on a name collision, grep for an EXISTING mitigation before proposing a fix

## Symptom

slang-rhi#820 R1 broke 8/8 native-Linux CI legs. The PR added the first three
`TextureUsage::None` uses to `tests/test-surface.cpp`; on Linux that file defines
`GLFW_EXPOSE_NATIVE_X11` and includes `<GLFW/glfw3native.h>`, which pulls
`X11/X.h:115` → `#define None 0L`, so `TextureUsage::None` expanded to
`TextureUsage::0L`. clang and gcc, x86_64 and aarch64, Debug and Release — all
identical (`error: expected unqualified-id` + `note: expanded from macro 'None'`).

The obvious read is "missing guard — add an `#undef None`". That read is wrong
about the *layer*.

## Root cause

`include/slang-rhi.h:27` **already** carries `#undef None` (next to
`#undef Always`, commented "Needed for building on cygwin with gcc"). The
project had already identified and mitigated this exact hazard. The defect was
that `testing.h` pulls `slang-rhi.h` in at line 2, *before* `glfw3native.h` at
line 12 re-defines `None`. So the mitigation runs and is then undone.

That reframes the fix: not "add a guard somewhere" but "re-apply the existing
guard after the include that defeats it" — a specific line in a specific file.
The author's follow-up commit did exactly that (`#ifdef None / #undef None /
#endif` immediately after the GLFW includes), and all 8 legs went green.

## How to catch it

**Before proposing or evaluating a fix for a name/macro collision, grep the tree
for an existing mitigation of that same name.** `grep -rn "undef <Name>"` over
`include/` and the core headers takes seconds. Finding one tells you the hazard
is known and the bug is an ORDERING failure; finding none tells you it is a
genuinely new exposure. These need different fixes in different files.

Corollaries worth carrying:

- **A pre-existing countermeasure is evidence about where the defect lives.**
  Its presence relocates the bug from "absent knowledge" to "defeated
  mechanism".
- **Platform-conditional includes make one TU's macro environment differ from
  every other TU in the repo.** `TextureUsage::None` is used freely elsewhere in
  slang-rhi and compiles fine; only the GLFW-native-including test file is
  poisoned. So "this token compiles everywhere else" carries **zero** bits about
  the file at hand.
- **A three-line test edit can be the merge-blocker.** The whole 🔴 was three
  tokens in a test file. Size of change predicts nothing about severity, and the
  risk was invisible in the design of the change — visible only in the build log.

## Fix

Traced the collision to include order and cited `include/slang-rhi.h:27` as the
defeated mitigation, which named the fix location precisely. When verifying the
follow-up commit, I compared **per-leg**: the 8 named native-Linux legs that were
`failure` at the old head are `success` at the new one (single `run_attempt`, no
rerun, `head_sha` confirmed). "CI is green now" would have been unfalsifiable and
would have folded a still-in-progress run into a pass — **name the legs.**

