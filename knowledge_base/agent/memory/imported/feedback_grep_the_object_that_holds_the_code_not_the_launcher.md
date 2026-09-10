---
name: feedback_grep_the_object_that_holds_the_code_not_the_launcher
description: "Four consecutive false zeros in one investigation (glob matching no file, wrong binary, wrong .so) — each read as a FINDING because I only checked the discriminator, never a positive control. A control validates the INSTRUMENT; run it in the SAME command as the discriminator or the zero is uninterpretable."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0a49331-2e8d-42f9-bc64-ae4bbd658822
---

# Grep the object that holds the code, not the launcher — and never read a zero without a control beside it

2026-08-06, slang #12393. Maintainer jhelferty-nv asked whether the backward-diff `ref`-param
abort reproduces **without** #11709. Answering required proving my build was clean master. I produced
**four false zeros in a row**, and *published a conclusion off the second one* before catching it.

## The four

1. `grep -rn "38038" source/slang/slang-diagnostic-defs.h` → `No such file or directory`, and my
   next line said **"ABSENT on master (=> #11709 introduces it)"**. The file does not exist at that
   path; the real defs live in `source/slang/slang-diagnostics.lua`. I turned a path error into a
   claim about upstream.
2. `grep -rn "38038" source/slang/slang-diagnostic-defs.*` → glob matched **no files** → zero →
   I again wrote "ABSENT". A glob that matches nothing exits cleanly and prints nothing: identical
   to a searched-and-found-nothing result.
3. `strings slangc | grep -c "ref parameter not allowed..."` → **0**. But `slangc` is a 223KB
   launcher; the compiler is `libslang-compiler.so.0.0.0.0` (2MB). I had *just* used that same
   command's sibling to declare "no #11709 in this binary."
4. `strings libslang.so | grep -c ...` → **0**. Wrong `.so` — `ldd` shows slangc links
   `libslang-compiler.so.0.0.0.0`, not `libslang.so`. Both files exist in the tree, so the path
   looked plausible.

## What actually caught each one

Only the **positive control** — a string that MUST be present if the instrument works:

```
=== POSITIVE CONTROL — abort string (must be >=1):   1     <- instrument works
=== POSITIVE CONTROL 2 — "differentiable" anywhere:  98    <- reading real strings
=== DISCRIMINATOR A — #11709's E38038 text:          0     <- now MEANINGFUL
=== DISCRIMINATOR B — #11709's E30711 text:          0
```

⭐⭐⭐ **The control and the discriminator must be in the SAME command.** I ran controls three times
and *still* mis-read, because I ran them in a separate invocation from the claim, then reasoned about
the claim alone. When they print adjacently, a broken instrument is visually undeniable: `0` next to
`0` where one should be `1`.

⭐⭐ **A control validates the INSTRUMENT, never the TARGET** — this is the sharpened form of
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] and the `MEMORY.md` anchor. Note the
anchor already told me a non-zero control doesn't certify a wrong-file read; what it did NOT cover is
that I can hold that rule and still *skip running the control at all* when the zero agrees with my
hypothesis. Holding a rule is not applying it.

⛔ **The direction of the error is the tell: every one of the four zeros supported the answer I
already expected** ("clean master, no #11709"). A false zero is not random — it fails toward
*whatever requires no further work*. When a zero confirms your hypothesis, that is precisely when the
control is mandatory, not optional. Compare
[[feedback_published_negative_env_claims_need_rederivation]]: a capability-negative has no failure
signature, so nothing downstream ever contradicts it.

## Reusable procedure for "is this binary built from X?"

Never infer from mtime or branch name — the tree can be at HEAD while the binary is two days old
(measured here: binary `2026-08-04 07:50`, HEAD commit `2026-08-06 10:49`, and it *was* still the
right baseline — mtime skew proves nothing either way).

```
L=$(ldd <exe> | awk '/libslang-compiler/{print $3}')   # ask the LOADER which object
strings $L | grep -c "<string that must exist>"        # control, same command
strings $L | grep -c "<string unique to feature X>"    # discriminator
```

Discriminate by **feature-unique strings** (here: #11709's `E38038` and `E30711` diagnostic texts),
not by version numbers. Two independent discriminators both reading 0 beats one reading 0.

## Result once the instrument worked

Repro **does** decouple from #11709: `[Differentiable]` + explicit `__ref` scalar param, function
never called, aborts on clean master `d7d59f374`. Introduced `45ccce9a3` (2026-04-01, Sai Praveen
Bangaru, "Refactor auto-diff implementation" #9808) — verified by pickaxe *plus* a before/after
`git grep` pair, absent at `45ccce9a3^`, present at `45ccce9a3`. See
[[project_12393_bwddiff_ref_param_abort]].
