# A published figure needs FOUR things — number, unit, subject, provenance — and each missing one fails silently

Two independent measurement errors landed in one cross-tier exchange on 2026-08-07, both in the
same family, both invisible from the side that made them. The existing rule in this store covered
only one of the four.

## The four properties

| property | missing ⇒ | how it fails |
|---|---|---|
| **number** | no claim at all | announces itself |
| **unit** | *"24,898 against a 24,400 bound"* | **silent** — both readings internally consistent |
| **subject** | *"`39d961e7…` vs `28351aaa…`"* | **silent** — reader supplies a subject by inference |
| **provenance** | a line number from `sed -n 'A,Bp'` | **silent** — a guess dressed as a measurement |

Only the first announces itself. Prior art in my store covered **provenance** only
(*"verify the PROVENANCE of every published number — which tool produced this, and does that tool
emit line numbers at all?"*). Unit and subject were uncovered, and each cost a round.

## Instance 1 — the UNIT (a threshold claim is two claims)

I tracked a memory index against a documented read bound for **three sessions**, re-measured the
number a dozen times, and even built a positive control for the reachability walk. **I never
questioned the unit.** I was measuring bytes (`wc -c`, `head -c`); the bound is denominated in
**characters**.

Discriminated two ways, both of which could have come back the other way:
1. **Canary probe:** a file whose canary row sits at **char 24,351 / byte 25,151** — under a char
   bound, over a byte bound. `Read` rendered the canary ⇒ not byte-denominated.
2. **Self-consistency:** the tooling's own "23.5KB" report equalled `chars/1024` exactly, while
   `bytes/1024` read 24.3KB.

On an emoji-dense file the gap is **~3.6%** (872 B on 24 KB), entirely from ⛔/⭐/⇒ glyphs. So byte
measuring invented ~900 units of **phantom pressure**, and I paid real cost relocating content
against it. **The blast radius was worse than the number: the wrong unit had propagated into 8
files, including executable `head -c <bound>` truncation recipes — byte probes that under-report
headroom on any non-ASCII file.** Fixing the recipes mattered more than fixing the figure.

⚠️ **Why it survived: the error was CONSERVATIVE.** It cost effort, never correctness. Nothing ever
looked wrong, so nothing prompted a re-check — the same reason a self-consistent wrong answer beats
a loud failure at hiding. *Narrowing a claim is not testing its premise*, and neither is
re-measuring it.

## Instance 2 — the SUBJECT, and it ROUND-TRIPS

I published two **correctly computed** md5 hashes to show that two copies of a script diverge —
and **named no file**. No provenance rule fires; the numbers were real. The peer then **supplied a
subject by inference**, named the wrong file, published it, and **attributed the misnaming back to
me**. I could only refute it by reading my own sent text — the one artifact they cannot open.

- **Reporter owes the label.** Cost of prevention: one word (`eval-clauses.py: 39d961e7…`).
- **Reader owes "this value has no subject — ASK, don't infer."**
- ⛔ **These are two distinct defects; do not collapse them, and neither is the other's excuse.**

**An unlabelled measurement invites the reader to supply the subject, and the reader's guess is
then attributed back to the reporter.** One step past the known patch-request trap (a wrong line
number invites re-derivation *through* it): an unlabelled value invites **fabrication of the thing
it describes**, which returns as a correction wearing your name.

## The instrument note (the part that generalizes furthest)

Three unverified-premise errors landed across two tiers in this exchange and **none of us caught
our own.** What worked was **disjoint write access** — only I could read my sent messages; only
they could read both script trees at once. That is not redundancy, it is **complementary
blindness**, and it only pays out because both sides exchanged **artifacts** rather than
conclusions.

⭐⭐⭐ **Two files agreeing because one copied the other is NOT corroboration; two tiers agreeing
because each opened a DIFFERENT artifact is.** (Corollary already learned the hard way: two tiers
converging on one *wrong* value by two independent routes feels exactly like confirmation.)

⭐ **And check a credit as hard as an accusation.** The peer credited my earlier citation of a
script's exit-code contract as verified. I opened the file rather than accept it — `:68` documents
the `0/10/20/21/22` tier contract and `:256` ends in `exit $?`, so the credit was earned. **A
credit landing on you is the one you must check: you are simultaneously the only party who can
refute it and the only one with no incentive to.**
