---
name: feedback_stripping_comments_leaves_the_same_hole_in_string_literals
description: "A structural/shape test that slices source by substring can read PROSE INSIDE A STRING LITERAL after comment-stripping 'fixed' it — the same defect class, narrower. Anchor slices on code syntax, not bare names."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1b682929-fcbb-4db5-a364-7db7eb3bd7a7
---

# A comment-strip is not a prose-strip: string literals are still prose

**2026-08-10, nanoclaw#1159.** The author found, recorded, and fixed a real defect in his own
tests: a structural test sliced `merge-train.sh` between `fetch-skills.sh` and
`validate:templates`, but **both strings also appeared in the comment block documenting the
design**, so the slice covered comments, passed happily, and missed a live inversion (the fetch
made fatal). Fix: strip `/^\s*#/` lines before analysis. He wrote it up as *"a structural test that
reads its own documentation instead of its subject is worse than no test."*

⭐⭐⭐**The fix was incomplete and the residue is the SAME defect class.** After stripping
comment *lines*, the first occurrence of the bare substring `validate:templates` is inside an
**echo string**:

```
echo "merge-train:   Continuing on cached skills — validate:templates below decides." >&2
```

So the slice's END boundary landed mid-`echo`, and everything after that line was outside the
assertion. **Constructed:** add `rollback_and_fail` after that echo (fetch now fatal, the exact
inversion the test exists to catch) ⇒ **9/9 pass, silent.**

⇒ ⭐⭐⭐**Comment-stripping narrows the target from "prose" to "prose inside string literals" —
it does not eliminate it.** Any source-slicing assertion has this hole wherever the program
*prints* the names it also *executes*, which is exactly what good operator messages do. The
better an error message is, the more likely it contains the identifiers the test keys on.

✅**Remedy that works and is one line: anchor on CODE SYNTAX, not a bare name.**
`sh.indexOf('validate:templates')` → `sh.indexOf('if ! pnpm run validate:templates')`.
Verified both directions: real script **9/9 green**, tamper **red**. A sibling test in the same
file was already safe *by luck* — it happened to anchor on `pnpm run validate:templates`, which
the echo does not contain. ⭐⭐**Two tests, one substring choice apart, opposite outcomes — so
"the file has a passing test for this" says nothing about whether the anchor is sound.**

## The generalizable check

⭐⭐⭐**For any test that slices source text: ask what ELSE in the file contains your anchor
string.** Cheapest form — print the slice and look at it:

```js
const i = sh.indexOf(ANCHOR);
console.log(JSON.stringify(sh.slice(i-60, i+30)));   // is this code, or is it prose?
```

That one line is what turned this from a reading into a measurement. See
[[feedback_mechanism_must_predict_observed_coordinates]] — the tell here was coordinates:
the anchor's *position* was in a string, not in the statement.

## The stronger move: the "unexecutable" tail was executable

The author justified shape-pinning with *"running it for real needs the full Node toolchain plus a
GitHub token."* False, and cheaply so: **`pnpm`/`npm` shims on `PATH` + a stub for the script the
real code already guards with `[ -f ]`** exercised all three paths against a synthetic git origin
in ~1s, and asserted the thing shape tests *cannot* — `rolled_back=YES` and the file contents
actually reverted, plus the true invocation ORDER of all six commands.

⇒ ⭐⭐**Before accepting "this can't be executed here", ask which of its dependencies you can
STUB rather than install.** A dependency that is only invoked by name through `PATH`, or guarded
by a file-existence test, is a stub away — no toolchain needed. Related:
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] framing in standing rule 4, and
ANCHOR C's *"ask what you have ALREADY RUN that discriminates it."*

## Also confirmed here (method credit)

⭐**Tamper drills reproduce a claimed figure exactly or they don't** — "removing X reddens 3
tests, inverting Y reddens 1" both matched on my edge, which is what made the *residue* worth
reporting rather than the whole test suite suspect. And a **placement** tamper (moving the tail
above the merge loop) went **6 red** via the pre-existing behavioral tests ⇒ credit recorded: the
shape tests were not load-bearing for placement, only for the soft/hard split.

Chain: [[project_nanoclaw_1159_deploy_validates_templates]].
