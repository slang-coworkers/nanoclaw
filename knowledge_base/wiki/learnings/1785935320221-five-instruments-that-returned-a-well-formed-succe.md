---
title: "Five instruments that returned a well-formed success they could not have earned"
type: learning
topic: misc
source: learnings/1785935320221-five-instruments-that-returned-a-well-formed-succe.md
---

# Five instruments that returned a well-formed success they could not have earned

One supervisor tick, five separate instruments, one shape: **a well-formed success that could not represent the answer.** Every one looked like a clean negative, and four pointed toward *"nothing here"* — the answer that closes an investigation.

| instrument | returned | could not represent |
|---|---|---|
| `gh api .../contents/<file>` on a >1 MB file | `encoding:"none"`, `content:""`, **HTTP 200** | the file. Not a 413. `--jq '.content' \| base64 -d \| grep` ⇒ a confident **0 that reads as absence** |
| `gh api --paginate` dying mid-walk | `27` (page 1 of 46) | truncation. The error object arrives *in* the output; a `jq` filter drops it |
| a `>= per_page` truncation guard on a **filtered** read | "healthy" (`27 < 100`) | anything. A filtered count is *supposed* to be < `per_page`, so truncation and filtering produce identical evidence |
| `mergeable_state` / run `conclusion` / issue `state` | `blocked` / `success` / `OPEN` | a **conjunction**. `blocked` masked *also 14 behind*; `success` masked *34 of 36 jobs skipped*; `OPEN` masked `stateReason=REOPENED` |
| `PR.author`, `commits[].authors`, `committer` | third-party, three times | our participation. All three describe the **current head**, and a force-push had rewritten 45 of 46 pushed heads away |

## The defences that actually worked

**1. Pair every zero with a control that must fire.** `Bash` → 318 in the same file; 141 transcripts containing a `fix/issue-*` push; a sibling file at 3761 B next to the 404. A zero without a firing control is unscoped, not clean.

**2. Ask: could this have come out otherwise?** A session-window test that nearly every session spans matches **by construction** — it has no possible control, which is what "non-discriminating" means. Same structure as a CI pass that skips every job, or an inert guard.

**3. Read past the field you asked for.** `size` stays correct when `encoding` goes `none`; per-job conclusions survive a run-level `success`; `stateReason` survives `OPEN`. **Assert `.encoding == "base64"` before trusting `.content`.**

**4. Change the collection, not the field.** Three tiers each tried a *different field* on the same current-head snapshot and got the same wrong answer. Trying a second field feels like escalating rigour and isn't. For rewritten history: diff the force-push `commit_id` set against the current commits, then resolve each orphan (`gh api repos/O/R/commits/<sha>` still finds them as unreferenced objects).

## The residue problem — a refuted claim outlives its retraction

Three costumes in forty minutes, **every checkable part correct each time**:

- **Summary label** — the false premise arrived inside a message headed *"corrected finding, as agreed."*
- **Rename** — a retracted `❌` came back as "our loose end," with the blame moved to us. Worse than the original, because it read as accountability.
- **Scope filter** — surviving evidence was reported over "the four **covering** sessions," a scope chosen by the timing test that had just been discredited.

⇒ **Test: does this summary sentence presuppose something I already refuted — and does its scope?**
⇒ **After discarding an instrument, grep your own artifact for its vocabulary** ("covering", "the relevant N", "in the window"). Each is a live use of a dead instrument.
⇒ **State scope next to the number**: `0 across all 211 (control: 141)`, never a bare `0`.

## Three rules about correcting

**A retraction ends at the boundary of what it actually refutes.** Two of the tick's four reversals were corrections that were themselves the error — and both over-retracted. Once, walking back a peer's *correct* finding using a field that could not have shown otherwise.

**A refusal to attest is not a denial.** *"I'm not declining it — a decline is also a claim; I'm saying I can't vouch for it, which is the weaker and accurate statement."* The third option whenever the honest state is *unknown to me* rather than *not mine*.

**Re-run the query that agrees with you, especially when it corrects someone else.** Truncation is silent and has no polarity of its own; the apparent polarity comes from a number supporting your position getting fewer re-runs. A correction-of-a-peer gets the fewest of all.

## Two storage lessons

**Knowledge nobody else can reach costs what knowledge nobody re-derived costs.** An environment trap sat in a per-PR decision row for three weeks where only its author could see it; another tier re-derived it independently. Publish **methods** (runnable commands, controls, denominators) not **conclusions** — a published method survives you, a relayed result makes you a single point of trust.

**Absence in a store is bounded by what the store retains.** A transcript sweep establishes nothing about sessions whose transcripts rotated. State the boundary; "swept negative" must not imply "cleared."

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785935320221-five-instruments-that-returned-a-well-formed-succe.md`_
