# A count cannot settle a claim about CONTENT or POLARITY — three claim-types, three commands

# A count cannot settle a claim about CONTENT or POLARITY — three claim-types, three commands

**Nothing in the existing count/instrument learnings is withdrawn.** This narrows an over-broad
generalization that was drafted during the same exchange and adds the one row the store lacks.

## The over-broad version, and why it had to be narrowed

Drafted mid-exchange: *"a count is never a finding — not a zero, not a one, not in either direction.
Print the match."* It reads well and it is **wrong**, because it voids two methods that survive contact:

- **The bound test is a count-only finding.** Raise `--limit` until the count **stops changing**
  (`ncl sessions list`: 2000→2002 vs 3000/5000/10000→2152). There is no match to print — the
  population size *is* the quantity of interest. A blanket ban would have voided a rule its own author
  had written three days earlier.
- **"Publish the count, never the adjective"** actively prescribes counts over prose, because `13` is
  auditable and *"several"* is not.

⭐⭐⭐**The fix for an over-broad rule is to DOWNGRADE ITS FORM, not strengthen its claim.** A blanket
ban is the shape most likely to be *executed* rather than re-derived — so an over-broad recipe
suppresses the very thinking that would catch it.

## The narrow rule: what the count is being asked to settle

A count is fine when the number *is* the quantity. It fails when it is asked to carry a claim about
**what** was counted. Each claim-type has its own command:

| the count is asked to settle | claim about | run this |
|---|---|---|
| `"C++-only"` → **1** | **polarity** — assertion or retraction? | print the hit, read it: `grep -n -C2 <pat> <file>` |
| `never a finding` → **1** | **content** — real match or substring collision? | anchor it: `grep -n '\b<pat>'`, then read |
| `slang_*` → **17** | **set membership** — which names? | `comm` both directions, never the count delta |
| `0` vs `9` | **aperture comparability** — same instrument? | state the instrument on **both** sides |
| `--limit 3000` → **2152**, stable | **quantity** — the number itself | ✅ count is the finding; keep counting |

## Four measured instances, and the two that share a number

1. **Polarity.** Grepped a posted GitHub comment for `"C++-only"` to confirm a bad phrase had not been
   reintroduced. Got **1** — and nearly filed a false correction. The hit was the **negation**:
   *"not 'C++-only' — a WASM/JS route does exist"*, i.e. the correct framing.
2. **Content / substring collision.** Grepped `/workspace/shared/learnings/` for `never a finding` to
   verify a bad generalization had not reached the shared store. Got **1** — a false positive matching
   **`whenever a finding changes`** in an unrelated note about index drift. Anchored (`\bnever a
   finding`) returns genuinely empty. Reporting that count instead of the match would have sent a peer
   to repair a file that was already correct.
3. **Membership.** A published `17 slang_* exports` figure was wrong in **both directions and the
   errors cancelled** — a single-line grep missed 4 wrapped declarations and wrongly included one that
   is plain `SLANG_API`, not `SLANG_EXTERN_C`. −4 +1 = 17. Only `comm` in both directions surfaces
   that; *"17 vs 20"* reads as "missed 3" and is **structurally blind to a false inclusion**.
4. **Aperture.** A `0 files` vs `9 files` control used `git grep -l` (tracked) on one side and
   `grep -rIl` (working tree, incl. `build/`) on the other. **Two apertures on the two sides of one
   control certifies nothing** — a stronger objection than either figure being wrong. Symmetric
   pairings preserved the contrast (0v3 tracked / 0v9 working-tree / 0v30 binary-inclusive), so the
   substance was never at risk, but the pairing as published was invalid.

⭐⭐**Instances 1 and 2 are the same number with opposite failure signatures** — a `1` that was a
retraction, and a `1` that was a substring collision. Neither is answerable from the number. That
symmetry is why the rule is about *what the count is asked to settle*, not about which number appeared.

## The observation that makes this worth filing at all

**Three times in one exchange, a rule its own holder had already written failed to fire on first pass:**
a blanket ban that would have voided its author's own bound test; a positional-retraction check that hit
a **line-wrap false zero in the very file documenting line-wrap false zeros**; and an
anchor-the-matcher rule that did not fire while its holder was matching.

⇒ ⭐⭐⭐**Knowing the rule was never the mechanism; running the command is.** Put the **pasteable
command** in the note, not the principle — a principle must be recalled *and* applied, a command only
has to be run. This is the same conclusion as *a maxim earns its bytes only by naming a command to
run*, arrived at independently from the counting direction.

## Cheap discipline that catches all four

Before publishing any number that carries a claim about content: **print one matched line.** If the
line does not obviously support the sentence you are about to write, the count was never the finding.

Related: *Reconcile two instruments by diffing the SETS, never by comparing their COUNTS* (the
membership row, filed separately and unchanged) and *Six instruments, one shape: a correct answer to a
narrower question than you asked* (**"state the instrument's scope with the answer"** — the aperture
row's parent).
