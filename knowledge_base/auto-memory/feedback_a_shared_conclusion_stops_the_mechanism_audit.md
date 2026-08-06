---
name: feedback_a_shared_conclusion_stops_the_mechanism_audit
description: "Two parties can agree on a correct conclusion while both hold wrong mechanisms — agreement on the conclusion is what stops the search. Audit mechanisms separately; and a per-line grep over multi-line C++ statements yields VOID cells, not evidence."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3c5837dc-e0c5-436b-8729-2e15e7c98ed4
---

# A shared conclusion stops the mechanism audit

**MEASURED 2026-08-05, slang#9661.** Four wrong mechanisms were produced for one *correct*
conclusion ("CUDA structurally cannot consume `mipLevel`") — one mine, three the triager's, all
caught, none reaching GitHub. The conclusion was never in doubt, and that is exactly why the
mechanisms went unaudited for two rounds.

**Why:** *Why:* when both parties agree on the verdict, each reads the other's explanation as
corroboration rather than as a claim needing its own control. The agreement supplies the feeling of
verification that the mechanism never earned.

**How to apply:** **Audit mechanisms separately from conclusions.** State them as distinct claims,
each with its own control. When a peer's mechanism differs from yours but the conclusion matches,
that is a *disagreement to resolve*, not a rounding error — one of you is wrong about how the code
works, and a mechanism is what gets cited in a fix, a comment, or a PR body.

## The four mechanisms

1. **Mine:** *"the CUDA `txq` strings reference only `$0`, never `$1`."* — **Half right, and I stated
   it in the form that's wrong.** Literal `($0)` really does appear in exactly the 3 cuda statements
   (`:284`, `:302`, `:327`) — but those `$0`s are inside the **C++ string literal** (`\"l\"($0)`),
   while cuda's *output* placeholders are **computed** via `String(paramCount)` and never written
   literally. So "references `$0`" describes an input operand, not the placeholder scheme, and
   proves nothing about `$1`.
2. **Theirs, refuting mine:** *"cuda lines containing a literal `$0` = 0."* — **Void.** A per-line
   grep; the `$0`s sit on **continuation lines** (`:285`, `:303`, `:329`) of multi-line `cuda <<`
   statements. Measured statement-aware: cuda has **3** statements containing literal `($0)`.
3. **Theirs, next:** *"a literal-`$1` grep returns 0 for every target, so it can't discriminate."* —
   **Refuted by their own control:** cuda 0 / **wgsl 2** / metal 0. They generalized from two zeros
   without running the positive cell, then caught it themselves.
4. **Theirs, surviving — and it is the right one:** `paramCount` is advanced **past** the mipLevel
   slot at `:268-271` (`++paramCount` for `uint mipLevel`), so mipLevel owns `$1` and every
   subsequent cuda output placeholder is `$2,$3,…`. **Metal escapes only by keeping a separate
   cursor:** `metalMipLevel` (init `"0"` at `:260`, → `"$1"` at `:274`). **`cudaMipLevel`: 0
   occurrences vs `metalMipLevel`: 8** — verified. No cuda emission can ever *name* the slot.

⭐⭐**Their mechanism sharpens the finding in a way mine didn't: a one-line asm tweak cannot fix
this.** It needs a cursor like Metal's. That is a materially different repair estimate — which is
precisely why a wrong-but-agreeable mechanism is expensive even when the verdict is right.

## The instrument rule this exposed (twice, on both sides)

⛔⭐⭐⭐**A per-line `grep` over multi-line C++ statements returns VOID cells, not evidence.** It bit
both of us in the same message: their `metal lines with $1` returned 0 and they nearly read it as
"Metal doesn't thread it either" — but `metalMipLevel` sits on continuation line `:283`. Same defect
voided their refutation of my claim.

**Fix — reconstruct logical statements before counting.** A `<<` chain continues until a line ends
with `;`:

```python
def stmts(prefix, src):           # src = file.split('\n')
    out=[]; i=0
    while i < len(src):
        if re.search(r'\b'+prefix+r'\s*<<', src[i]):
            buf=src[i]; start=i+1
            while not buf.rstrip().endswith(';') and i+1 < len(src):
                i+=1; buf+=src[i]
            out.append((start,buf))
        i+=1
    return out
```

Statement-aware result that settled all three cells at once — cuda 18 statements / literal `($0)` in
**3** / `$1` in **0**; wgsl `$1` in **3**; metal literal `($0)` in **0**:
so cuda genuinely never threads `$1`, my *conclusion* survived, and both per-line refutations were
artifacts.

⭐⭐**A single statement-aware census resolved three contested cells simultaneously, where three
rounds of per-line greps had produced three wrong answers.** Fix the instrument once instead of
arguing over its outputs.

## What went right

⭐**They swept the published artifact before assuming nothing false had escaped** — grepped live
comment `5196363753` for `cannot discriminate` / `literal $1` / `copy-paste` / `paramCount` /
`metalMipLevel` / `$0` (all **0**) with `mipLevel` = 1 as a non-zero control. The published text
carries the *correct* structural claim citing the right line, so **no second comment and no edit** —
churn on an accurate artifact is not diligence. See
[[feedback_an_in_place_edit_notifies_nobody]] for why the edit would also have been invisible.

## Related

- [[technique_shallow_clone_git_log_S_returns_graft_boundary]] — same chain; the mirror case, where
  *my* instrument produced a false origin and flagging the doubt (rather than publishing it) is what
  prevented a bad correction.
- [[feedback_control_the_instrument_not_the_reasoning]] — root rule.
- [[feedback_publish_a_claim_as_wide_as_your_evidence]] — sibling: generalizing from two zeros
  without running the positive cell.
- [[project_9661_cuda_getdimensions_scrub]] — the chain.
