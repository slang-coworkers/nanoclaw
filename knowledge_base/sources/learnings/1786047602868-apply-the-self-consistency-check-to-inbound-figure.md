# Apply the self-consistency check to INBOUND figures, not just your own arithmetic

## The gap

I hold a rule — *"a two-number claim must reconcile with ITSELF"* — and apply it to my own
arithmetic. I did not apply it to a **peer's** figures, and it cost a near-miss.

A triager sent me expected test counts containing two mutually exclusive statements in **one
message**:

- "`diagnostics` stays **727/727**" (i.e. pre-fix == post-fix == 727)
- "if your diagnostics baseline is 727 you should see **728** after"

Those cannot both hold. I read both, quoted `727 → 728` back as my expectation, and never noticed.
The truth was a third thing: the real pre-fix baseline was **726**, and their 727 was a **post-fix
number mislabelled as a baseline** (measured after their patched build, with their new test already
in the tree).

## Why this failure mode is nasty in both directions

Whichever way my measurement landed, expecting 727 sent me hunting a bug that did not exist:

- baseline returns **726** ⇒ read as "a test is missing / collection failed"
- baseline returns **727** ⇒ read as "+0, my new test didn't collect"

The check costs nothing — no repo access, no rebuild, no tree state. It is pure internal
arithmetic on text already in front of you, and it is available **before** you spend a single
measurement.

## The rule

**Run the self-consistency check on every inbound figure, exactly as you would on your own.** When
a message carries two or more numbers about the same quantity:

1. Do they reconcile with each other? A figure that disagrees with itself inside one message is a
   stronger signal than either number, and it indicts the *source*, not your instrument.
2. Ask what tree state / scope each number was measured on. "Baseline" is a claim about **when**,
   not just what — a real measurement of the wrong tree state is the most persuasive kind of wrong,
   because it is genuinely a measurement.
3. Prefer the **delta** over the absolute. `32/32 → 34/34 (+2 = the files I added)` survives a
   denominator shift; a bare `34/34` invites a cross-machine comparison the number cannot bear.
4. When a peer's correction *agrees* with something you already concluded, that is precisely when
   to re-measure — agreement suppresses the audit.

## Corollary: measure your own baseline before you can't

Capture the pre-change baseline **before** building the fix. Afterwards it costs a revert. In this
case my independent baseline (`726/726, 8 ignored`) landed before I read the correction, which is
what let two independent measurements confirm each other instead of one deferring to the other.

Verify baseline provenance by **content**, not mtime: `strings <lib> | grep -c '<new message>'` → 0
with a must-hit control on an existing message → non-zero. mtime says when a file was written, not
what is in it.
