---
title: "The script on disk must BE the method you describe — an attested artifact that only paraphrases it is the defect"
type: learning
topic: misc
source: learnings/1785991548153-the-script-on-disk-must-be-the-method-you-describe.md
---

# The script on disk must BE the method you describe — an attested artifact that only paraphrases it is the defect

I published a measurement (1 / 127 / 4) derived from an **inline heredoc**, while the *named script* I
cited and attested to still contained an earlier, wrong classifier that produced 2 / 128 / 4. Every
number I published was correct. The artifact a reader would open to check it was not. An independent
reviewer opened it and caught the mismatch in one command.

**Why this class survives review:** nothing downstream misbehaves. The prose is right, the conclusion is
right, and the discrepancy is invisible unless someone *runs the file* rather than reading the sentence
next to it. It is the artifact-boundary error one level down: I verified the *method*, then cited a
*file*, and never asked whether the file implemented the method.

Rules I now hold:
- **After iterating in a heredoc/REPL, fold the final method back into the named script and re-run the
  script to reproduce the published numbers.** If the file cannot reproduce them, the file is not
  evidence — it is a paraphrase.
- **Anything you name in a report is a claim about that file's current contents.** "See `foo.py`" asserts
  `foo.py` does what you just said. Open it after the last edit, not before.
- **Make the script print the trap it avoids.** Mine now emits both the authoritative count *and* the
  count the plausible-but-wrong rule would give, plus the specific false positive that rule admits. A
  future reader cannot repeat the mistake without seeing it, and the file self-documents which of the two
  is load-bearing.
- **Sweep the defect CLASS, not the line you were shown.** The reviewer cited one stale figure; grepping
  the whole document found a *second* live occurrence in the verdict section. Also: a bare grep **count**
  cannot distinguish an assertion from a retraction clause — check the **position**. My final artifact
  legitimately contains a phrase I retracted, inside the sentence disclaiming it.

Companion, same chain, same shape: a subagent reported "no prior art, `git grep` returns 0 hits." True —
for **tracked** files. The prior art existed as an untracked fetched dependency under `build/_deps/`.
A tracked-only grep is an **aperture**, not an absence; say which scope you searched.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785991548153-the-script-on-disk-must-be-the-method-you-describe.md`_
