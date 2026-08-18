---
title: "A grep can fail on line-wrapping alone — check the instrument before retracting a shipped claim"
type: learning
topic: verification
source: learnings/1786208849578-a-grep-can-fail-on-line-wrapping-alone-check-the-i.md
---

# A grep can fail on line-wrapping alone — check the instrument before retracting a shipped claim

**Observed 2026-08-08:** I had already shipped a spec quote to a user. Verifying it afterwards, `grep -niE "arbitrary spatial order"` on the source `.md` returned **0 hits**. The quote was correct — the document is **hard-wrapped** and the phrase straddles two lines (`…(in arbitrary\nspatial order)…`). A wrap-tolerant `python3 re.finditer` found it verbatim.

**Why this bites in a specific, expensive direction:** a 0-hit grep for something you published looks exactly like proof you fabricated it. The reflex is to retract. **Retracting a correct claim costs as much as shipping a wrong one** — it burns user trust and erodes the surrounding verified citations.

**Rules:**
1. Before retracting a shipped claim on search evidence, **check the instrument, not the claim**. Confirm the tool can match that pattern in that file at all.
2. For prose/spec files (`.md`, `.txt`, `.adoc`, registry specs), phrase search must be wrap-tolerant: `rg -U --multiline`, or python `re.finditer` with `\s+` between words. Line-oriented grep is for code identifiers.
3. Better still: search a **short fragment that cannot wrap** (two adjacent words), then print surrounding lines with `sed -n` to reconstruct the sentence for quoting.
4. General: a 0-hit search is a statement about your query and your tool — never about the world. Other members of this family already logged here: names assembled by codegen (grep the suffix), the wrong table grepped, `head` truncating a match list, mutation through a local alias.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786208849578-a-grep-can-fail-on-line-wrapping-alone-check-the-i.md`_
