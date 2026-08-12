# slangc -v lies about freshness (CACHE var), and IRPtrType's address space defaults to Generic when the operand is absent

Two independent traps hit in one investigation (shader-slang/slang#12386, master `9eb90c50a`). Both are the same shape: **a value that looks measured but is actually a default.**

## 1. `slangc -v` under-reports by weeks even on a freshly built binary

`./build/Debug/bin/slangc -v` printed `2026.13.1-61-ga916653b70` on a binary I had just built from HEAD `9eb90c50a`, which actually describes as `v2026.14.1-42-g9eb90c50a0`. Not a stale binary — `SLANG_VERSION_FULL` is a **CACHE** variable in `cmake/GitVersion.cmake:113`, so `git describe` runs on *first configure only* and never refreshes on reconfigure or rebuild. Only a fresh `build/` dir corrects it.

**Never use `slangc -v` to confirm which commit you are testing.** Use instead:
- binary **and shared-library** mtimes — check `build/Debug/lib/libslang-compiler.so.*`, not just `slangc`. `slangc` is ~339 KB; the 61 MB library holds the compiler code you are measuring.
- a **behavioural discriminator**: pick a commit in your range that changed observable behaviour and run its repro. Here HEAD was itself "Fix segfault on empty capability switch case (#12357)", so an empty `switch` case compiling with exit 0 (vs segfault) proved the binary was post-fix. This is strictly better than any version string.

**Corollary on inherited freshness controls.** A peer's memo established binary validity with "0 commits touched these files between the object build time and HEAD." That was true *for their snapshot* and did not transfer to my clone, where the binary was 10 days old and **8 commits** had touched the relevant files — including one that changed the very pass under investigation. Re-derive freshness in your own tree; a freshness control is scoped to the tree that ran it.

Also: after `git pull`, source **mtimes** are rewritten, so "source newer than binary" is true for files whose content never changed. The valid instrument is `git log <base>..HEAD -- <paths>`; the mtime comparison is not.

## 2. `IRPtrTypeBase::getAddressSpace()` returns `Generic` when the operand is simply absent

`source/slang/slang-ir.h:1600`:

```cpp
AddressSpace getAddressSpace()
{
    return getOperandCount() > 2
               ? (AddressSpace) static_cast<IRIntLit*>(getOperand(2))->getValue()
               : AddressSpace::Generic;     // silent default
}
```

The address space is an **optional third operand**. A bare `Ptr(%Empty)` in an IR dump has none, so it reports `AddressSpace::Generic` (`0x7fffffff` = 2147483647) — *not* the value you would infer from the Slang surface syntax. Note `core.meta.slang:1394` defines the surface default `AddressSpace.Device` as `UserPointer` (`0x100000001`), so **the surface default and the IR default disagree**, and reasoning from the source spelling gives the wrong answer.

This is what made #12386 fire: `createLegalPtrType` (`slang-legalize-types.cpp:983-997`) handles a legalized-away (`none`) pointee by producing an untyped `Ptr<void>`, but only `case AddressSpace::UserPointer:` / `case AddressSpace::Global:`. A `Generic` pointer falls through to `return LegalType()` and the pointer type collapses to `none` even though the `var` it came from has a real address.

**How to read this correctly from an IR dump — and the control that makes it trustworthy.** "The dump printed no address space" is ambiguous: it could mean the dump never prints them. Get a positive control in the *same* dump — a pointer that does carry the operands renders as `Ptr(UInt, 0 : UInt64, 2147483647 : UInt64, ScalarLayout)`. Once you have seen the dump render operands, their absence elsewhere is real evidence.

**Second useful probe:** spelling the address space explicitly in source (`Ptr<T, Access.ReadWrite, AddressSpace.Device>`) changed nothing — same abort. That proved the failing operand was the compiler-generated `var` inst, not the user's declared pointer type, i.e. unreachable from source and not user-workaroundable. Cheap way to separate "user spelled it wrong" from "the compiler built this shape."

## The generalizable rule

Both traps are a **silent default masquerading as a measurement**: a cached version string, an absent operand. When a getter has a `? :` fallback or a value comes from a cache, ask *what does this return when it does not know?* — and never let that answer enter a claim without a control that would have looked different.
