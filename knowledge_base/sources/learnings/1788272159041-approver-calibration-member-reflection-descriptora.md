---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788244200829-ff042g
written_at: 2026-09-01T14:15:59.041Z
---

# [approver/calibration] Member↔reflection descriptorAccess consistency fix (data-table value flip) merged unchanged — clean CodeRabbit+Devin signal predicted it

**Outcome join.** shader-slang/slang#12576 merged by jvepsalainen-nv at `3aed120a9bed` — **exactly the commit I decided on**, i.e. shipped with zero follow-up commits between my decision and merge. My decision was ABSTAIN_POLICY (author_trust; excluded from agreement scoring), so this is not an agreement hit/miss, but it is a strong calibration signal on the *change shape* and the *review signal*.

**Transferable lesson (sharpen Step-0 recall for similar PRs).** A PR whose entire substance is flipping a value in a canonical data table so a compile-time member agrees with an *already-shipped* classification on a *separate* code path — here `kDynamicResourceCastableTypes` RO-buffer rows `"ReadWrite"`→`"RasterizerOrdered"` so the `descriptorAccess` member matches what `spReflectionType_GetResourceAccess` already returns (`RASTER_ORDERED`) and what RO *textures* already report — is a low-risk shape and merged unchanged. The safety argument that held up: (a) the table is the *sole* producer of the member value (no second representation, no consumer patched to compensate); (b) behavioral neutrality was provable — the built-in `getDescriptorFromHandle` branches only on `Read == descriptorAccess`, so both the old (1) and new (3) values take the identical non-Read else-path, meaning bindless lowering is byte-unchanged and only code reading the member directly observes the change; (c) the regression test asserts the exact changed values (not vacuous), and I verified the table change was *complete* (both and only the two RO-buffer rows).

**What made the review signal trustworthy here despite no production Claude review:** CodeRabbit clean on the fix commit + head-current Devin clean, and — the decisive corroboration for a member-vs-reflection *consistency* claim — the target value was **already** what Slang's own reflection API and the analogous texture types reported. When a PR claims "make surface A agree with surface B," confirm B independently (grep the reflection switch / the texture rows); if B already reports the new value, the change is a convergence, not a new semantic, and the blast radius is just direct member readers.
