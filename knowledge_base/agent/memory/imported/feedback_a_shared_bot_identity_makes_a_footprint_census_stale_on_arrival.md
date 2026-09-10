---
name: feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival
description: "\"Zero public footprint\" was true when measured and false ~10 min later when I asserted it — a SIBLING session posted under our shared bot identity. No channel announces a sibling; re-query the comment list at the instant of the claim."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# A shared bot identity makes a footprint census stale on arrival

**Measured 2026-08-06, slang#12385.**

I told `slang-triager` twice that #12385 had **zero public footprint beyond its own body**, and built a
recommendation on it (*"if #12382 merges with #12385 still silent, that's the one to chase"*). It was
true when I measured it (06:2xZ, `comments_count: 0`). A **sibling session** posted cmt
**5201336027** at **06:48:27Z**. My restatement went out at **06:58Z** — ~10 minutes after it was
false.

⛔ **The census was invalidated by an agent I share an identity with.** Both comments are
`nv-slang-bot[bot]`, `type=Bot`, `id=274397474` — indistinguishable by author from anything I would
post. So "has our side spoken publicly?" is **not** a question my own session state can answer, and
nothing notifies me when a sibling speaks.

⇒ **Re-run the comment list at the moment of the claim, never carry a footprint census across a turn:**
`gh api repos/<o>/<r>/issues/<n>/comments --jq '.[] | "\(.id) \(.created_at) \(.user.login) id=\(.user.id)"'`.
One call. The failure is silent and it propagates: a "nobody has posted" premise licenses *"place the
footprint"* advice, and the recipient may act on it by posting a second verdict under one identity.

⭐⭐ **This is the same-identity twin of the account-confusion trap already in the store.** There, two
*different* accounts shared a login stem and I matched on `login` instead of `id`
([[project_12371_spirv_prelink_validation_buffer]], the IDENTITY TRAP row). Here the `id` matches
**correctly** and is still not evidence about *which session* acted. ⇒ **`id`/`type` identifies the
identity, never the actor.** For "did *I* do this", compare against your own recorded comment ids.

⭐⭐⭐ **Generalized 2026-08-06 after the MIRROR error landed an hour later: classify the identifier as
ACTOR or THING before inferring from a match.** A matching **thing**-identifier (`dev+ino`, soname,
mtime) proves *same object*. A matching **actor**-identifier (`login`, bot `id`) proves *nothing about
who acted*. Both failures this session were one misclassification each, in opposite directions — I
under-read a bot-`id` match here, and a peer over-read a `dev+ino` match into "your rows are swapped"
(see [[feedback_name_the_agent_as_well_as_the_path]] instance 4b). **Same identifier shape, opposite
epistemics.**

✅ **The discriminator that works when identity is uninformative: TIMESTAMP THE ARTIFACTS.** Comment
`created_at` settled this census; probe-output mtimes bounded a tainted-binary blast radius; sub-second
mtimes on three files settled the clone dispute in one exchange. When *"who acted?"* is unanswerable,
*"when did each artifact appear?"* usually still is — and at full precision it is decisive.
See [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]].

✅ **What the peer did right on discovering the sibling, worth copying:** it (a) verified the sibling's
claims before building on them *because they publish as it*, and (b) **scoped its own comment to a
delta** — measuring what the sibling had not covered (collision=0, `IncompleteLibrary`=0,
`TargetRequest`/`TargetProgram`=0, dump-module=0) rather than posting a competing verdict. Two verdicts
on one issue under one identity is the outcome that discipline avoids.

✅ **I verified the sibling's headline claim myself for the same reason** — an
`AbortCompilationException` escaping a `SLANG_NO_THROW` public C API: `include/slang.h:5694`; macro is
`__declspec(nothrow)` on MSVC-family (`:208`) and a **no-op** elsewhere (`:212`); handler census
`slang-compiler-tu.cpp` **0** try/catch vs `slang-session.cpp` **19 try / 12 catch**. Sound. ⭐ **When
a sibling publishes under your identity, its errors become yours — verification is not optional
courtesy, it is self-defense.**

Chain: [[project_12385_precompile_validation_gate]].
