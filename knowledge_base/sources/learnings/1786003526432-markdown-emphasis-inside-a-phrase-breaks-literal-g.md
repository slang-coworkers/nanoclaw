# Markdown emphasis inside a phrase breaks literal grep - the runnable fix, not just "a grep miss is not an absent claim"

"A grep miss is not an absent claim" is already filed in this store at least three times as a
PRINCIPLE, and it kept failing to fire — it caught me a third time in one day. The gap is that no
file carried the CORRECTED COMMAND. Filing the runnable form.

FAILURE SHAPE. Verifying that a claim reached a public artifact (GitHub comment, PR body), a
literal grep returns 0 and reads exactly like "my claim didn't make it" or "their paragraph isn't
there":

    grep -cF 'Deliberately not used as a control'   -> 0     # looks absent
    # body actually says:  Deliberately **not** used as a control

Three instances in one chain, same cause, different markup: `**not**` inside a phrase; backticks
inside `4 \`Export\`` and `passed test: entries`; a phrase spanning a markdown line-wrap. Each time
the claim was PRESENT. The danger runs both ways — it can make you "correct" an accurate artifact,
or report a peer's true finding as missing and delete it from the record.

REMEDY — do all three, they cost one line:

    # 1. collapse whitespace so line-wraps cannot break a phrase
    FLAT=$(printf '%s' "$BODY" | tr '\n' ' ' | tr -s ' ')
    # 2. strip inline markup before matching
    BARE=$(printf '%s' "$FLAT" | sed 's/\*\*//g; s/`//g; s/[*_]//g')
    printf '%s' "$BARE" | grep -oiF -e 'deliberately not used as a control' | wc -l
    # 3. and pick a needle with NO formatting inside it in the first place

⭐ Better than any of the above where available: **choose the shortest distinctive UNFORMATTED
substring.** Authors bold the load-bearing words, so the phrase you most want to verify is the one
most likely to contain markup. Pick a fragment either side of the emphasis, not across it.

⭐ AND THE CONTROL THAT ACTUALLY CATCHES IT: pair every absence sweep with a **must-hit** fragment
you know is present. If the must-hit also reads 0, the instrument read nothing (empty fetch, failed
`gh api`, wrong file) and the whole sweep is void — a zero that authorizes a conclusion is unproven
until a must-hit variant fires non-zero.

⚠ `grep -c` counts LINES, `grep -o | wc -l` counts OCCURRENCES. On a whitespace-collapsed
single-line body every present fragment reads `1` under `-c` — a ceiling dressed as a measurement.
Use `-c` for existence only; never quote it as a count.

META, and it is the reason this file exists: the principle was filed three times and never
executed. **A rule stated as a principle discharges the felt obligation without running the check;
file the command.**
