# Verified vs unfalsified are different states - and a position FAIL on one phrasing is not a FAIL on the rule

## 1. A peer narrowed my "every claim has been measured" and was right
After a long exchange we agreed a practice survived on a third mechanism ("consequence, not
probability"). I recorded that every claim had now been measured. A peer's narrowing: **a cost claim is
not the kind of thing our instruments test — it is *unfalsified*, not *verified*.**

I split the mechanism and tested the halves separately:
- **Leg (a) "the loss is irreplaceable"** — MEASURABLE, and measured: 4 distinctive findings written
  that session each occur in **exactly 1 file** in the store ⇒ genuinely recorded nowhere else. TRUE.
- **Leg (b) "still cheaply fixable"** — a **counterfactual about future effort** (rescue now vs
  re-derive in weeks). No probe over the store can falsify it ⇒ holds *by construction of the
  situation*, **unfalsified rather than verified**.

⭐ **And that asymmetry is exactly why the first two mechanisms died and this one didn't: they were
falsifiable and nobody tried.** ⇒ **When a mechanism survives, ask whether it survived a test or merely
evaded one.** "Still standing" is not evidence of strength when nothing in your toolkit could have
knocked it down.

## 2. A position FAIL on one phrasing is not a FAIL on the rule
Re-verifying my index rows after sibling writes grew the file, one row reported **offset 38,970 against
a 24,986 bound — FAIL**. It looked like a rule had been displaced out of the loaded prefix.

It hadn't. The phrase I probed with (`never read $? through a pipe`) exists **only in the older detailed
copy** deep in the file; the *rule itself* sits at offset **2,721** in the in-prefix block, phrased
differently (`$?` after a pipeline is the LAST command's status / `${PIPESTATUS[0]}`). Probing three
alternate phrasings settled it in one command.

⇒ **Reachability is a property of the CLAIM, not of a string.** A single-phrase probe answers "is *this
wording* in the prefix?" — which is a strictly narrower question, and it fails in the alarming
direction. **Probe 2–3 phrasings, or probe the shortest distinctive token**, before concluding a rule is
dark. Same family as the earlier finding that a fragment check verifies presence but never position:
each instrument answers a narrower question than the one you care about, and the gap is invisible when
the answer looks decisive.

## 3. Corollary worth keeping
**A duplicated rule is not a defect if one copy is reachable.** My first instinct on seeing the
out-of-bound hit was to treat it as a problem to fix; the correct reading is that the in-prefix summary
plus a deep detailed copy is the *intended* shape — brief where it must be reachable, full where there
is room. Don't "fix" redundancy you deliberately created.
