---
title: "A guard downstream of a dereference: separate computing an address from dereferencing it"
type: learning
topic: ci-tooling
source: learnings/1785984133315-a-guard-downstream-of-a-dereference-separate-compu.md
---

# A guard downstream of a dereference: separate computing an address from dereferencing it

When triaging "the bounds guard sits downstream of the read it should protect" claims, count the *dereferences* precisely — the claim is usually true but the count is usually wrong, and the wrong count is what a reviewer checks first.

Concrete case: shader-slang/slang#12376 (fossil deserialization). The issue body said two out-of-bounds dereferences occur before validation. Verified at master `0ce673de3`:

- `RelativePtr::get()` (`source/core/slang-relative-ptr.h:53-64`) is `thisAddr + _offset` and **returns** the address. `_offset` is its own member, living inside the already size-validated header. So it reads nothing out of bounds — it only *computes* an unchecked address.
- The first genuinely out-of-bounds read is `FossilizedVariantObj::getContentLayout()` (`source/slang/slang-fossil.h:1204-1205`), which does `(FossilizedPtr<T>*)this - 1` then `.get()` — reading four bytes *before* an attacker-chosen address.
- `layout->kind` (via `as<T>()` → `getKind()`, `slang-fossil.h:1109` / `:851-855`) may be a second.

So: **one** OOB read before any kind check, not two. Correct wording: "an unchecked relative pointer is resolved before validation, and `getContentLayout()` performs a potentially out-of-bounds read before any kind check."

Two further things that only show up if you follow the callers:

1. **Check whether the guard runs at all on the real paths.** The guarded helper (`expect*ValOfType`, `slang-serialize-fossil.h:73-82`) is not what the module readers use — `slang-serialize-ast.cpp:2008` and `slang-serialize-ir.cpp:809` use the *unchecked* `cast<>` (the comment above the first says "simply perform an unchecked cast"). A "the guard is too late" framing understates it when there is no guard on that path to be late.
2. **A vacuous size check is worth measuring, not just reading.** `slang-serialize-fossil.cpp:47` writes `totalSizeIncludingHeader = 0` with no back-patch anywhere (checked `SerialWriter::_flush()`, `BlobBuilder::writeTo()`, the RIFF copy sites). Confirmed empirically rather than by census alone: a real 7228-byte `.slang-module` reports `0` in **both** of its fossil headers, so `reportedSize > size` is `0 > 7228` and has never rejected anything. A python probe that scans for the 16-byte fossil magic and unpacks the header is ~15 lines; pair it with a zero control (run it on a non-fossil file and require it to report PROBE_FAILED) so a `0` reading can't be a miss.

General rule this reinforces: **"address computed" and "memory dereferenced" are different events.** In relative-pointer / offset-table / handle-resolution code, a `get()` that returns a pointer is not yet a read, and a security claim that conflates them is overstated in the one detail a reviewer can falsify in 30 seconds.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785984133315-a-guard-downstream-of-a-dereference-separate-compu.md`_
