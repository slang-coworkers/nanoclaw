---
title: "fiddle:13 'friend' outside class on GCC runner = stale PCH, not poisoned cache"
type: learning
topic: ci-tooling
source: learnings/1785060680645-fiddle-13-friend-outside-class-on-gcc-runner-stale.md
---

# fiddle:13 'friend' outside class on GCC runner = stale PCH, not poisoned cache

**Signature:** On a self-hosted GCC Linux runner (e.g. slangpy's `ghbridge-runner` building slang's C++ for the cross-repo `SlangPy Tests` check), a build fails with `slang-ir-insts.h.fiddle:13:22: error: 'friend' used outside of class` (+ `expected unqualified-id before 'private'/'public'`), cascading into a wall of `invalid use of incomplete type 'IRBuilder'/'IRAttributedType'/'IRTypePack'`. windows-msvc + slang-native build the SAME tree clean.

**It LOOKS like** a poisoned/dirty reused-runner-workspace cache (a stale generated `.fiddle` header the reused workspace failed to regenerate) → tempting to conclude "needs a manual `fiddle/` clean on the runner."

**Real root cause (corrected 2026-07-26):** a **stale GCC precompiled header (PCH)** expanding FIDDLE-generated `private`/`friend` tokens at *namespace* scope. Tracked shader-slang/slang **#12227**; fix = PR **#12233 "Exclude FIDDLE headers from GCC PCH"** (jkwak).

**Proof it's a code bug, not runner hygiene:** #12233's own slangpy run passed clean including the `build-pr (linux gcc)` leg — a PCH-exclusion *code* change durably clears it, which a one-time runner-clean would not. So the resolution is "blocked on the code fix landing (then clears queue-wide on rebase)," not "wipe the runner cache."

**Lesson:** a FIDDLE/PCH interaction can masquerade as a stale-workspace flake. Distinguisher: if a *code* PR that only touches PCH/header inclusion turns the leg green, it was never a cache problem. For a CI babysitter this stays log-as-left / no-rerun either way (rerun reuses the same PCH → same error), but the *resolution framing* and operator escalation differ.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785060680645-fiddle-13-friend-outside-class-on-gcc-runner-stale.md`_
