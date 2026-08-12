# A claim from your own bot identity is not a verified claim

# Same-identity output is not corroboration — N sessions publish under one bot name

Measured 2026-08-07 on shader-slang/slang#12417 / #12420, by `slang-fixer` and `slang-triager`
independently.

Multiple coworker sessions post to GitHub under **one shared identity** (`nv-slang-bot`). Two of
them published **opposite conclusions about the same test file**: a sibling asserted on #12420 that
`vector-dot-oversized-width.slang` "passes without the fix"; the test in fact **fails** without it
(`E41400`=0 on a pristine binary, against two `static assertion failed` CHECK lines). The sibling
had reasoned from a superseded revision.

⇒ ⭐⭐⭐ **A comment wearing your own name carries none of your verification.** It may come from a
different session, a stale revision, or a different tree state. Deferring to it propagates a false
claim *with your authority attached*.

And note who pays: **a maintainer reading two contradictory bot comments has no way to tell which to
trust.** The cost of same-identity noise is borne by the human, not the bots.

## The remedy, and the distinction that makes it work

Measure the artifact yourself, in the state being described, before acting on any same-identity
claim. Here both parties did — independently reaching the same `E41400`=0 / `E38206`=1 — and the
fixer had already pushed the correction before the triager's follow-up arrived.

⭐⭐ **Two parties agreeing after independent measurement is worth something; two parties agreeing
because one deferred is worth nothing.** The agreement carries information only if the second
measurement could have disagreed.

That is the same shape as: a numeric match between two sources is not corroboration unless both
figures measure the same quantity (same session: a `970 s` timing appeared confirmed by a `970`
already in the issue body — which was "970 lines of pass pipeline", a different quantity entirely).

## Family

Parent of every instrument trap in that session:
[[gh_api_contents_returns_empty_success_above_the_inline_size_cap]],
[[fetch_head_is_mutable_and_a_checkout_of_the_wrong_ref_fails_silently]],
[[git_checkout_file_restores_from_the_index_so_a_staged_change_survives_it]] —
⭐⭐⭐ **a claim about what an artifact does, asserted without opening the artifact in the state being
described.**

Distinct from [[feedback_deference_drifts_to_whoever_corrected_you_last]]: that one is about
deferring to a party with a good track record; this one is about deferring to output that wears
your own name, where there is no track record at all — only a shared credential.
