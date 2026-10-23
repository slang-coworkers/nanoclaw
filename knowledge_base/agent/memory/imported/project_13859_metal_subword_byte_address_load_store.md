---
type: project
name: project_13859_metal_subword_byte_address_load_store
description: "WAITING ON MAINTAINER 10-22 10:54Z. Triaged bug/medium/P2, no fixer: reporter PR #13863 (fix/metal-bab-subword-store, Fixes #13859, reviewer dshreiner-nv) fixes both problems with narrow device ushort*/uchar* stores; #13776 fixes only the compile error and duplicates part of #13863. Timer: triager one-shot i13859-recheck-91e1 (10-27). slang#13859 (albertrodriguezclo, external): Metal 8/16-bit ByteAddressBuffer Load/Store: scalar emits invalid MSL (as_type between different sizes), and vector/struct subword stores race (non-atomic read-modify-write of the 32-bit word). Overlaps open PR #13776 (WeakKnight, scalar fix via the same non-atomic RMW), bot draft #13815 (#13805, same file), WGSL sibling #13661 (triager owns)."
---

# slang#13859: Metal subword ByteAddressBuffer loads/stores

**10-22 10:28:20Z `issue_opened`.** Main webhook session `sess-1792664902449-wqnllc` (thread
`gh-issue-shader-slang/slang-13859`). Live read at 10:29Z: open, 0 comments, no labels, unassigned, empty
timeline, no PR naming #13859. Only session on the canonical thread is this one; no task names it.

**Overlaps found at routing time.**
- PR #13776 (WeakKnight, external, `metal-byte-address-subword`, open, not draft, behind, reviewer
  dshreiner-nv, only a coderabbit review): routes scalar subword accesses through the existing legalize
  RMW path. Fixes problem 1 but its body says the store stays a non-atomic RMW, which is problem 2.
- Bot draft #13815 (fix/issue-13805, [project_13805_wgsl_byte_address_aligned_array_load_store](project_13805_wgsl_byte_address_aligned_array_load_store.md)) edits the same file.
- #13661 (WGSL `Store<half>`, same author, assigned jkwak-work): triager sessions `h8d820` + task `i13661-recheck-6b22`.

**Disposition.** Human report, unassigned, no author PR yet: dispatched to slang-triager on the canonical
thread (precedent [project_13823_metal_combined_sampler_handle_anyvalue](project_13823_metal_combined_sampler_handle_anyvalue.md)).
Brief: look for an author PR first (#13853 → #13855 came 28 s later), and do not plan a fixer PR that
competes with #13776.

**10-22 10:54Z [Triage] (triager msg 16; memo /workspace/inbox/a2a-1792666494274-838wq0/triage-13859.md):** bug / medium / P2,
IR byte-address legalize → Metal emit. Not a regression (2026.13.1 is the same). Reproduced on master 0bd71cd70 from the emitted MSL; the
Apple-compiler rejection and the M4 race are the reporter's results.
- The reporter opened **PR #13863** at 10:33Z (5 min after the issue; non-draft, `Fixes #13859`, reviewer dshreiner-nv). It is #13776's
  scalar-legalize change plus a Metal-only `storeSubWordValuesDirectly`, which emits narrow `device ushort*`/`uchar*` stores with no RMW.
  The triager's local probes all emit clean stores, and tests/metal, wgsl, hlsl-intrinsic and compute pass 1593/1593.
- #13776 fixes only the compile error; the race stays. It merges cleanly with #13863, but the merge leaves a duplicate dead block. The
  maintainer picks. #13815 merges cleanly with #13863. #13852/#13735 have trivial adjacent-line conflicts.
- GitHub: the triager set Type=Bug and the `reproduced` label (I checked both live). No issue comment, because #13863 already gives the
  trail. Reviewer nits (odd 16-bit offset `>>1`, soft-fail assert) are only in the memo.
- **Held:** no fixer and no bot post. Timer: the triager's one-shot `i13859-recheck-91e1` (10-27). **Resume on:** an @nv-slang-bot
  mention, an operator ask, or #13863/#13776 closing.
