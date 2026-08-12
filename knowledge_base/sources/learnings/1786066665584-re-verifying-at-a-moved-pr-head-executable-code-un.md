# Re-verifying at a moved PR head: "executable code unchanged" ≠ "the build was fresh"

## Two hazards, one review

On shader-slang/slang#12413 the PR head moved mid-review (`2645bb88c9` → `ecdce0f642`). Both
the reviewer and the fixer hit a build-provenance problem, from opposite directions.

**Fixer's hazard — a green build over a tree that no longer exists.** His rebuild compiled
`slang-check-overload.cpp.o` at 01:16; he then edited that source at 01:33. Ninja finishes
`EXIT=0` and produces a binary from the **pre-edit** source. He caught it by comparing object
mtime against source mtime rather than trusting the exit code:

```bash
ls -la --time-style=+%H:%M:%S build/.../slang-check-overload.cpp.o \
                              source/slang/slang-check-overload.cpp
# object must be NEWER than source
```

This is sharper than a tree-hash-before/after gate because it localizes *which* TU is stale.

**Reviewer's hazard — re-running tests at a new head against an old binary.** I re-verified
after the head moved without rebuilding. That was legitimate, but the mtime check is the wrong
justification. The real one:

```bash
# per source file: empty diff => that TU is byte-identical, binary still valid
git diff <old> <new> -- source/slang/slang-check-overload.cpp

# for files that DID change: strip comment lines, see if anything executable remains
git diff <old> <new> -- source/slang/slang-check-impl.h \
  | grep -E '^[+-]' | grep -vE '^[+-]{3}' | grep -vE '^[+-]\s*//'
```

Both empty ⇒ the binary is behaviourally identical to one built at the new head.

## The distinction that matters

- **"the build was fresh"** — false in my case; I never rebuilt.
- **"the executable code did not change"** — true, and sufficient.

Easy to conflate, and only the second was available. Say which one you're claiming: *"verified
at the new head"* implies a build you didn't do.

## Why the header is the load-bearing case

Intuition says "only a header changed, that's minor." **It's the opposite** — a `.cpp` change
affects one TU, a change in a widely-included header (here `slang-check-impl.h`) would require
recompiling every TU that includes it. It's safe *only* because the non-comment filter above
returns zero hunks. If a declaration had moved, the old binary's test results would be a stale
artifact reporting on source it never compiled — and that failure **looks exactly like a
successful verification**.

## Cheap end-to-end confirmation

Independent of every mtime, confirm the artifact actually contains the source you think:

```bash
strings build/Release/lib/libslang-compiler.so \
  | grep -c 'overriding a candidate declared in this module'   # a string the change introduced
```

Note it may be in the shared library rather than the thin `slangc` driver — check the `.so`,
and check its version suffix (a fresh `libslang-compiler.so.0.2026.14.1` vs a stale `…13.1`
sitting beside it is itself a signal).
