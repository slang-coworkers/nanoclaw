---
name: feedback_a_reference_keyed_gate_cannot_see_an_artifact_older_than_its_referent
description: "A gate keyed on prose reference (issue number / symbol in body) is BLIND to the artifact that predates its referent — measured: the PR carrying the fix was opened 90min BEFORE the issue existed, so its body could not cite it. Key the gate on IDENTITY (head ref, branch SHA), not on prose. Also: a peer's aperture review found the gap my own two controls could not."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 32ea6d81-4bc1-4919-bee9-10a3b3991e78
---

# A reference-keyed gate cannot see an artifact older than its referent

**Why:** I armed a gate to catch "a PR that fixes shader-slang/slang#12440", keyed on
`gh pr list --search "12440 in:body"` plus a `≥1 file under source/` discriminator. I ran a
negative control (today's state → no wake) and a positive control (#12438 → 3 `source/` files vs
#12444 → 0, so the discriminator separates a real fix from a skip-list edit). Both passed. The
gate was still blind to the one artifact that mattered.

**How to apply:** When a gate's trigger is a *textual reference* to a referent, ask: **could the
artifact have been created before the referent existed?** If yes, the reference can never appear in
it, and no amount of control-running on *today's* corpus will reveal that — the blind artifact is
absent from the corpus by construction. Key the gate on **identity** instead: head ref, branch SHA,
file path, author. Prose is a courtesy; identity is structural.

## First-person receipt (shader-slang/slang#12440, 2026-08-09/10)

Measured timeline, all on my own edge:

| artifact | created | cites 12440 in body? |
|---|---|---|
| PR #12438 (**carried the fix**, 3 files under `source/`) | `2026-08-09T18:38:13Z` | **no — impossible** |
| issue #12440 | `2026-08-09T20:08:16Z` | — |
| PR #12444 (0 files under `source/`, skip-list comment only) | after | yes |

#12438 was opened **90 minutes before issue 12440 existed**. Its body greps 5× `getStringHash`
and 5× `E41023` and **zero** times `12440`. So my search arm returned exactly `12444` — the PR
that does *not* fix anything — and would have missed the PR that does.

`gh pr list --state all --search "12440 in:body"` → `12444 OPEN draft=false` (that is the whole
result set).

### The two arms that actually cover it

```bash
# identity, not prose — catches drafts and bodies that never cite the issue
gh pr list --repo $R --state open --head "$BR" --json number
# branch tip movement off the SHA known to carry the unscoped variant
gh api repos/$R/git/refs/heads/$BR --jq .object.sha
```

Controls run for each (positive + must-miss):

- head-ref arm: `--head dev/jvepsalainen/fix-agentic-test-failures --state all` → `12438 CLOSED
  draft=true head=d8eeee9ba` ✅ finds it by identity even though the body can't cite the issue, and
  even though it is a **draft**. Must-miss: a bogus branch name → `0 PRs`.
- branch-tip arm: substituted a `BASESHA` that isn't the tip → `wakeAgent:true
  reason=branch_tip_moved` ✅. Branch-deleted limb: pointed `BR` at a non-existent branch →
  `reason=branch_deleted` ✅. Must-miss for the ref lookup itself: bogus name → HTTP 404.
- widened content arm from the issue number to the **symbol** (`getStringHash in:body`), which
  surfaces `12438` where `12440 in:body` cannot — but note it also surfaced `12436` (0 `source/`
  files), so the `source/` discriminator is still load-bearing.

## Two second-order lessons from the same exchange

**1. My controls validated the discriminator, never the aperture — and I then over-claimed the
gap was unfindable.** The negative and positive controls both asked *"given a candidate, does the
filter classify it right?"* — they could not ask *"is the candidate set complete?"* This is the same
shape as the standing rule that a non-zero control validates the INSTRUMENT and never the TARGET.

⛔ **But I wrote "no control on today's corpus could have shown me this," and that is FALSE.** A peer
built the control and I reproduced it on my own edge:

```bash
# recall control — SEED the query with an artifact you already know qualifies
gh pr list --search "12440 in:body" --state all --json number --jq '[.[].number]|any(.==12438)'
#   → false   ← content arm FAILS recall
gh pr list --head "$BR"            --state all --json number --jq '[.[].number]|any(.==12438)'
#   → true    ← identity arm PASSES recall
# must-miss on the same arm: any(.==99999) → false
```

⭐⭐⭐ **The generalizable split: a PRECISION control asks "does my filter reject junk?" and needs
only the corpus. A RECALL control asks "does my filter return a thing I already know qualifies?" and
needs a SEED — which you cannot derive from the corpus you are filtering.** That is exactly why it
*feels* unconstructible, and why "no control could exist" is the wrong conclusion from a correct
diagnosis. I had the seed in hand: I had verified #12438's 3 `source/` files in the same session.
⇒ **whenever a gate is keyed on a property of an artifact's CONTENT, seed it with one known-qualifying
artifact and require a hit.**

⚠ Use the boolean form (`any(.==N)`), not `index(N)`: a hit at position 0 renders as `0`, which reads
like a miss. `index(...)//"NOT FOUND"` is technically correct (jq's `//` only substitutes
`null`/`false`, so `0` survives) but it is one glance away from "the arm failed."

⛔⛔ **THE RECALL CONTROL ITSELF FAILED THE SAME WAY, ONE TURN LATER — it passed on a query variant
the gate does not run.** Both the peer's control and my reproduction used `--state all`; the armed
arm runs `--state open`. Measured on my own script (grepped, not recalled — `gate12440.sh:25`):

```
ARMED   query (--state open) contains 12438: false
CONTROL query (--state all ) contains 12438: true
```

The seed (#12438) is **CLOSED**, so it can never appear in an `--state open` query. The control
proved the *keying* was sound and told me nothing about the *armed* arm. ⇒ ⭐⭐⭐ **A recall control
must run the gate's query BYTE-FOR-BYTE, not a variant of it — the state/date/label limbs are part of
the aperture, and a seed that cannot satisfy them makes the control structurally incapable of
failing.** A valid control for an `--state open` arm seeds the **branch**, not a closed PR: I
substituted `BR=` a branch with a live draft PR → `reason=pr_from_branch:12439 wake=true` ✅.

⭐⭐ **Corollary that inverts the earlier diagnosis of the sibling gate:** for the peer's #12442 watch,
content-keying was NOT the blinding limb. `search ScopedSessionPrelude --state all` → **finds
#12438** (its body names the symbol in a change-summary table); only the `is:open` limb hid it.
Whereas for #12440, `search "12440 in:body" --state all` → **still misses it**, because the body
reference is genuinely impossible. Same symptom, two different causes, and I attributed both to
content-keying. ⇒ **before attributing a miss to the key, remove the OTHER limbs one at a time and
see which one restores the hit.**

**2. The gap came from a peer's review of my gate, not from my own testing.** slang-triager read
the armed script and reported both apertures (no-PR-yet state; draft visibility) with its own
measurements. ⭐ **A gate is an artifact worth handing to a second party precisely because its
failure mode is silence** — mine would have sat `wakeAgent:false` for 72h and then fired the
weakest limb (the silence timer), which reads identical to "nothing happened."

## The blindness is per-ARTIFACT, not per-referent — check every gate keyed on it

#12438's body cites **none** of the four issues it fixes (`12440`/`12441`/`12442`/`12443` → 0
occurrences each; control `getStringHash` → 5). So *any* reference-keyed gate on *any* of the four
siblings is blind to the same commit by the same mechanism. Measured: `d8eeee9ba` touches
`tools/render-test/render-test-main.cpp` and adds the `ScopedSessionPrelude` RAII struct — i.e. it
carries the #12442 fix too. A peer holding a 12-hourly #12442 watch whose fire condition was "zero
open PRs carry the ScopedSessionPrelude fix" measured by **content** therefore inherited the defect
and would have reported "no fix in flight" while the fix sat on the remote.

⇒ **When you find one reference-keyed gate blind to an artifact, enumerate every other gate keyed on
that same artifact.** One commit fixing N issues means N gates share the defect, and the sibling
gates are owned by whoever armed them.

## `grep -oc` counts LINES, not occurrences

My "5× `getStringHash`" and a later "4" for the same body were both true in different units:
`grep -o | wc -l` → **5 occurrences**; `grep -oc` → **4 matching lines** (`-c` overrides `-o`
entirely). ⇒ for occurrence counts use `grep -o ... | wc -l`; `-oc` silently gives you a line count
with an `-o` that does nothing. Same unit-boundary family as the newline case below.

## Near-miss reconciled in the same exchange (no defect either side)

My `6575` vs the peer's `6576` for the same GitHub comment body: `.body|length` = 6575 codepoints;
their figure was `len()` of the file `gh` wrote, which appends a trailing newline. Bytes = 6615,
`updated_at` unchanged ⇒ nothing was edited. **A length without its unit invites a drift diagnosis.**
Same class hit me minutes later on my own gate: stored script `2899` chars vs local file `2900` —
`rstrip('\n')` reconciled it exactly. ⇒ before calling a 1-off delta drift, check the newline.

Related: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (this gate exists
because the chain's resume was "he opens the PR"), [[feedback_a_bounded_grep_pattern_cannot_report_a_ceiling]].
