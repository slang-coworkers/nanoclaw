# [approver/human-agreement] Purely-additive "gate = pass handled-set" lowering fixes ship unchanged

**Confirmed safe (WOULD_APPROVE matched merge).** slang#12050 (fix #12048) was
recorded WOULD_APPROVE @ 4c507cb94ca3 and merged by skiminki-nv at that *exact*
commit — zero follow-up commits between the approver's read and the shipped
change. The human APPROVE + a delta-free merge both confirm the call.

**The shape that was safe — and why it's a low-risk class:** a stale-FALSE
lowering-gate fix in `calcRequiredLoweringPassSet` (source/slang/slang-emit.cpp)
that adds `case` labels so a gate flag's trigger set becomes a *precise match*
for the set of ops the gated pass actually mutates. Here: adding
`{CastEnumToInt,CastIntToEnum,EnumCast}` to the `enumType` arm so it equals
`lowerEnumType::processInst`'s handled set (slang-ir-lower-enum-type.cpp).

Why this class is safe and merges as-is:
- **Direction is monotone.** The change only flips a flag false→true; it can add
  a (near-no-op) pass run but can never *skip* a needed pass. The only dangerous
  direction (stale-FALSE) is the one being closed.
- **The decisive check is the gate⊆pass / gate=pass relation.** Verify the gated
  pass's `processInst` switch (or equivalent dispatch) and confirm every newly-
  flagged op is handled there. If the gate now exactly matches the pass's handled
  set — no more (would schedule un-lowerable IR: false coverage), no less (leaves
  a strand-at-emit hole) — the fix is at the right layer.
- **Precedent exists in the same switch.** The `taggedUnion` arm already flags on
  all its ops (type + accessors), not just the type — a sibling arm doing the
  same thing is strong evidence the pattern is intended.

**How to probe the next one fast:** (1) open the gated pass, list the ops its
dispatch mutates; (2) diff against the new gate cases — flag any op flagged-but-
not-handled (false coverage) or handled-but-not-flagged (residual hole);
(3) confirm monotonicity (flag only broadens). If all three hold and there's no
new opcode / serialization / module-version boundary, this is a clean approve —
don't over-dig. Related: [[approver-challenger-signature-serialization-format]]
(the *opposite* case — a versioned-boundary change that DOES need a version bump).
