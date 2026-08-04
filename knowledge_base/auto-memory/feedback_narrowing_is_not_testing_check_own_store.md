---
name: feedback_narrowing_is_not_testing_check_own_store
description: "Narrowing a claim is not testing its premise; and the answer may already be in your own store — rhi#800/#801 Metal residency polarity inversion"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ebc97d95-2f9b-4394-8606-40fc4e77d695
---

# Narrowing a claim ≠ testing its premise · check your own store first

## 🔴 The inverted fact (read this before citing any Metal residency claim)

`m_hasResidencySet = true` is assigned **only** inside
`else if (m_device->supportsFamily(MTL::GPUFamilyApple6))` (`src/metal/metal-device.cpp`
L121, verified at `25234e0d` / merged `d8c609ef`). GitHub-hosted `macos-*-arm64`
runs an **`Apple Paravirtual device` that lacks Apple6**, so control reaches the
terminal `else` (L145) logging
`GPUFamilyApple6 not supported; using per-encoder useResource fallback`.

⇒ **CI runs the `!m_hasResidencySet` FALLBACK by default.** The fallback is the
**covered** path; the residency-**SET** path is the uncovered one and needs
Apple6 hardware CI does not have. ❌ `SLANG_RHI_METAL_NO_RESIDENCY_SET` was
**never** the missing artifact — it forces the path CI already takes.

Consequences: the address map is **live**, `find()` **does** run
(`resolvePointerFieldResidency`, `metal-shader-object.cpp:735`), and **7
`bind-pointers-*.metal` cases passed** at the decision head — pre-existing
coverage predating the PR.

## What I did wrong, weakest → strongest

**1. Absence of a log line is not evidence until you prove the line would print.**
`checkDeviceTypeAvailable` assigns `result.debugCallbackOutput` only inside the
`RETURN_NOT_AVAILABLE` failure macro (`tests/testing.cpp:884`) ⇒ on a green run
the string is empty and the reporter's *unconditional* `printf` emits nothing.
**An unconditional print does not imply an unconditional value.** Measured 0× in
the green job I kept re-reading, 3× in a *failing* sibling job. The affirmative
evidence lived in the log I never thought to open.

**2. ⭐ Narrowing is not testing.** I retracted "the fallback is unexercised" and
rewrote it as "the fallback is unverified" — weaker, **same direction, same
untested premise** (*which path does CI take?*). A retraction that narrows without
testing the premise **inherits the error and launders it as diligence**. Ask what
single observation settles it, and whether it's cheap, *before* recording either
version. Here: one unauthenticated `curl` of a public job log.

**3. ⭐⭐ The answer was already in my own store.**
[[feedback_green_job_skipped_backend_zero_coverage]] `:38-41` already recorded the
verbatim `GPUFamilyApple6 not supported; using per-encoder useResource fallback`
line *and* the conclusion "CI exercised the *fallback* path — which inverted an
earlier claim." I contradicted my own note for an entire chain. **Recall failure,
not evidence failure**: recall loads at session start, it does not fire when you
form a new claim. ⇒ When a claim turns on a **stable environment property**
(runner GPU family, image contents, required checks, driver tier), **grep your own
store for that property before reasoning about it.**

**4. ⭐⭐⭐ …and "grep your own store" was itself UNEXECUTABLE — that is the only
fixable layer.** Do not stop at lesson 3; I did, and it was still broken. Both
stores held the fact, so I asked why checking failed: `/workspace/shared/learnings/INDEX.md`
was **2058 lines of titles truncated to ~50 chars**, and `Apple6`,
`m_hasResidencySet`, `NO_RESIDENCY_SET`, `useResource` each returned **ZERO hits**.
The fact lived only inside long file bodies. So the remedy I filed depended on a
lookup that structurally could not succeed — **an aspirational rule, not a rule.**

**Before filing any "always check X first" rule, run the check as a stranger would
and confirm it returns the fact. If it doesn't, the deliverable is the INDEX ENTRY,
not the rule.** What made the fix work (all four terms now hit):
- searchable **tokens in index text**, plus aliases — not only in file bodies, and
  never relying on a truncated title;
- **explicit polarity** — half-remembered facts invert, which is exactly what
  happened twice here;
- **name the anti-artifact** (❌ don't cite `SLANG_RHI_METAL_NO_RESIDENCY_SET`), since
  the wrong next step is the expensive part;
- record the **evidence class** (inference vs same-run observation);
- **verify the grep hits after writing.**

Same family as: a stated rule can't reach the write site ⇒ *make the wrong thing
impossible* rather than restating the rule. The diagnosis chain went "I was wrong
about a GPU family" → "I didn't check my notes" → "checking was impossible"; only
the last is actionable, and it's reachable only by going after the *why* instead of
accepting an already-agreed conclusion.

## Corollary for relaying

A coworker and a bot reviewer independently agreed with the wrong premise.
**Independent agreement on a premise nobody tested is not corroboration.** Relaying
a coworker's grounds makes them mine — and I had the disconfirming rows (the 7
`bind-pointers-*.metal PASSED`) in a log I pulled myself and *pasted into my own
report*, then relayed "`find()` is never called" over them.

Related: [[feedback_published_negative_env_claims_need_rederivation]] (a 403 on one
endpoint ≠ the fact is unavailable — `/branches/main/protection` 403s but
`/branches/main` returns the summary), [[feedback_correction_must_sweep_whole_file]]
(grep the **superseded** wording; my top-block fix missed a second stale copy 140
lines down), [[feedback_mechanism_must_predict_observed_coordinates]].

Chains: [[project_slang_rhi_800_metal_dispatch_indirect]],
[[project_slang_rhi_801_metal_buffer_import]].

## ⭐⭐ THE CARRY-FORWARD, IN FULL — and I nearly left it out of the file that owns it

**The rule:** *before recording a caveat about a mechanism, grep your own store for that mechanism, and name the
observation that would settle it.*

**Why this one and not the expensive ones:** a **contradiction with your past self is the cheapest signal
available** — no API call, no peer, no reasoning. It costs a `grep` of a file you already wrote. Yet across a
19-error chain neither tier ran it: we fetched job logs, re-derived a count three independent ways, ran
adversarial critique rounds, split files at their read limits, and audited each other line by line — while the
residency polarity sat in **my own notes at zero cost** the entire time
(`feedback_green_job_skipped_backend_zero_coverage.md:38-41`, and verbatim in
[[project_slang_rhi_801_metal_buffer_import]]).

⇒ **Every expensive check can be diligence theater relative to the free one you skipped.** The ranking is
counter-intuitive and that is exactly why it needs writing down: *effort spent* feels like *rigor achieved*,
so the zero-cost check reads as too trivial to bother with and gets deferred indefinitely.

**Second half, equally load-bearing: name the observation that would settle it.** "Which path does CI take?" was
answerable by one unauthenticated `curl` of a public job log. A caveat recorded without naming its settling
observation cannot be discharged by anyone later — it just accretes hedges.

**❌ I committed the closing-claim error too (19th-equivalent, mine).** I cited this rule as the chain's top
finding for several turns. Positive check on this file: `cheapest` = 0, `past self` = 0,
`name the observation` = 0 — the *full* form existed nowhere in my store, only the narrowing half. **Fifth
carry-through error, on the file that owns the rule against carry-through errors, in the turn I claimed to be
closing out.** Caught only by the positive half of the sweep — the half that was missing when this chain began.
Cf. [[feedback_sweep_rule_case_study_rhi800]].

## ⭐⭐ THE EVIDENCE FOR THIS RULE IS THAT BOTH TIERS FAILED IT SIMULTANEOUSLY (2026-08-03, 19th error)

Not an anecdote — the load-bearing datum, and the piece most likely to be dropped when this file is summarized.

**Main and `slang-pr-approver` each cited this rule as the chain's top carry-forward while each store held only a
fraction of it** — the narrow *"grep before attributing a defect elsewhere"* half, never the general form. Both
discovered the gap **in the same turn**, each by running the positive check on their own file:
`grep -c "own store" MEMORY.md` → 0 for the peer; `cheapest` / `past self` / `name the observation` → 0 for me.
**Neither could catch their own; each caught the other's.**

⇒ **This is the argument for adversarial pairing over any amount of individual care.** Reviewing your own claim,
you re-run the reasoning that produced it — so the review inherits the blind spot. Reviewing someone else's, you
have no such prior to re-run. Demonstrated here *on the rule about verification itself*, which is the strongest
form the demonstration can take: the failure survived two agents who were, at that moment, maximally attentive
to exactly this class of error.

**Corollary for anyone compressing this file:** the mutual-simultaneous-failure fact IS the evidence. A summary
that keeps the rule and drops how it was found leaves a plausible-sounding maxim with nothing under it — and a
maxim without its evidence is what gets optimized away by the next reader. Cf. [[feedback_correction_must_sweep_whole_file]]
(a structural convention that doesn't explain itself gets tidied out).


---

## ⭐⭐⭐ THE CHAT-ONLY AUDIT — run this before closing any long exchange

**The failure:** a claim stated fluently in replies *feels* recorded. It isn't. Both slang-triager and I
ran this audit at the end of one long session (2026-08-03) and **each found exactly one unstored
claim — both on lessons about verification discipline** ("verify the constraint before optimizing
against it", mine; "structural move beats nibbling", theirs). Neither was findable from memory; both
took ten seconds to find by grep.

⚠️ **This failure is invisible from inside the conversation** — fluency reads as durability. And note
the meta-instance: for most of that session **this very procedure was itself chat-only**, which is why
it is written here as a command rather than as advice.

```bash
# For each substantive claim you asserted in replies this session.
# ⚠️ BOTH STORES, and RECURSIVELY — a glob is non-recursive and misses subdirs (both defects proven below).
ROOTS="$HOME/.claude/projects/-workspace-agent/memory /workspace/agent/memory"
FILES=$(find $ROOTS -name '*.md' 2>/dev/null); C=$(echo "$FILES" | wc -l)   # DENOMINATOR
for P in 'distinctive fragment 1' 'distinctive fragment 2'; do
  H=""
  while IFS= read -r f; do
    N=$(tr '\n' ' ' < "$f" 2>/dev/null | tr -s ' ' | grep -ciF -e "$P")  # collapse+squeeze, literal, -e
    [ "$N" -gt 0 ] && { H="$f"; break; }
  done <<< "$FILES"
  [ -n "$H" ] && echo "STORED    $P -> $H  (of $C files)" || echo "CHAT-ONLY $P  (searched $C files)"
done
```
⭐ **Report the denominator** (`searched C files`): per the drift rule, a **collapsing** C means the
store moved and a `CHAT-ONLY` verdict is untrustworthy — not that the claim is missing.

**Rules for reading the result:**
- A zero is a **question, not a verdict** — ladder it under 4–6 wordings before concluding "unstored"
  ([[feedback_audit_grep_false_negatives_asymmetric]]); both of our real finds survived the full ladder.
- Probe a fragment **inside one styled run**; never one straddling `**`/`` ` ``/`[…]`, and never with an
  embedded `\n` (the triager's insert failed exactly that way, in this note's sibling).
- The output that matters is **`CHAT-ONLY`** — write it to the child, then decide what the index hook
  needs. Not the reverse; the default urge is to put it in the line you are looking at.

⇒ **The deliverable of a lesson is the stored file plus its index entry, never the sentence in the
reply.** Corollary to this file's own rule: a store that cannot be *retrieved* is not a store — and one
that was never *written* is not even that.

### ⚠️ FOURTH reading rule — SEARCH BOTH STORES (the version I first stored did not)

There are **two** memory roots: `~/.claude/projects/-workspace-agent/memory/` (453 files) and
`/workspace/agent/memory/` (73 files). My first stored version of this procedure looped `for f in *.md`
— **one store** — and slang-triager flagged the omission. Proven with a real case rather than argued:

```
fragment 'Core Memory'   auto-store: 0 hits   okf-store: 1 hit
⇒ single-store loop prints "CHAT-ONLY Core Memory"   ← FALSE, it is stored
```

That is the **worst-direction** false negative for this procedure specifically: `CHAT-ONLY` is the
output that triggers writing, so a single-store audit **manufactures the justification for rewriting
content you already hold** — duplicating a lesson instead of finding it
([[feedback_audit_grep_false_negatives_asymmetric]], the asymmetry: a false negative reads as "absent"
and licenses action).

⭐ Note what this is an instance of: **the audit is itself a probe, and it had M9's wrong-file-set
defect** — right command, incomplete file set. I documented that form for other people's checks and then
shipped it in my own audit procedure, one turn after writing the rule.

### ⚠️ …AND THE FIX HAD THE SAME DEFECT AGAIN — a glob is NOT recursive

The both-stores fix above was itself wrong on first write: `"$D"/*.md` iterates **one level**.
Measured on my own store — **glob 527 files vs `find` 530** — and the decisive case:

```
fragment 'Open Knowledge Format'  → glob: 0 hits   find: 1 hit  (memory/system/definition.md)
```

So the stored procedure printed **`CHAT-ONLY`** for content I hold. slang-triager hit the identical
variant in its store the same turn (598 vs **602** files, same fragment).

**Both of us shipped M9's wrong-file-set form INSIDE the audit, twice, in consecutive turns** — first by
searching one store, then by globbing non-recursively — each time one turn after documenting that exact
form ([[feedback_audit_grep_false_negatives_asymmetric]] M9).

⭐⭐ **The sharp corollary — formulated by slang-triager, 2026-08-03 (its wording, my confirming
instance): a verification procedure is the *most* likely place to ship the defect it documents, because
writing the rule feels like having applied it.** Same family as *fluency reads as durability*, one level
up: there, articulating a lesson felt like storing it; here, documenting a defect class felt like being
immune to it.

⚠️ **Attribution note.** I first recorded this sentence with no author, which in my own file reads as
mine — the unattributed-fact failure ([[feedback_unattributed_fact_reads_as_your_own]]), caught only by
asking *whose formulation is this?* after the triager credited **me** with it. Both of us were about to
mis-credit the other: it offered me the sentence, I had left its name off. **The facts are joint (two
independent instances, one per store); the wording is theirs.** ⇒ When a peer hands you a better
formulation, record the handoff in the same edit that records the sentence — a week later the file is
the only witness, and an unattributed line defaults to its holder.

⇒ **Two mechanical guards, both cheap:** use `find` over explicit roots (never a glob), and **print the
denominator** so a shrunken file set is visible in the output instead of being invisible in a `0`.
