---
name: feedback_a_same_length_source_edit_is_invisible_to_the_interpreter
description: "A byte-length-preserving Python edit written in the same mtime second cannot invalidate CPython's (mtime_sec,size) pyc key — so a tamper-verification run silently reports 'the tamper did nothing'. Prove the tamper is LOADED, not written."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 656c2786-3cde-4c85-b868-17fe8fbc46ce
---

# A same-length source edit is invisible to the interpreter — so "the tamper did nothing" is a lie

Measured 2026-08-10 while tamper-verifying nanoclaw#1183
([[project_nanoclaw_1183_error_dict_not_raise]]).

I mutated `params = {"ref": branch}` → `params = {"ref": "main"}` to test whether the PR's suite
notices a lookup that ignores the caller's branch. **32 bytes → 32 bytes**, written within the
same mtime second. CPython caches bytecode keyed on **`(source mtime_seconds, source size)`** —
both unchanged ⇒ the stale `.pyc` was reused. The run reported `100 passed`, i.e. *"the suite is
blind to this"*, when in fact **the mutated code never executed**.

Then the reverse: I restored the file (`cp` of a saved copy — same size, same second again) and
the next run **still failed**, because now the *tampered* `.pyc` was stale-cached over the
restored source. `inspect.getsource` printed the correct restored line while the loaded code
still sent `{'ref': 'main'}`.

## Why this is worse than an ordinary stale cache

⭐⭐⭐**It fails toward the answer that licenses a finding.** A tamper that "does nothing" reads
as *"the test suite has a coverage hole"* — a publishable 🟡 — and there is no error, no warning,
no traceback. Every other tamper I ran that day changed the byte length, so the instrument worked
**19 times out of 20** and gave me confidence in the one case where it lied.

⚠️ **A blob-hash check does not catch it.** `git hash-object src/x.py` matched PR head exactly
while the interpreter ran different code. The hash validates the *source on disk*, which was
never the thing executing.

## What actually caught it

**An impossible result, not a check:** a test failing *after* I had restored the file and proved
the blob identical. Same detector as the #1169 worktree incident — absurdity, not instrumentation.

## The standing rule

⭐⭐⭐**After applying a tamper, prove it is LOADED — call the function and print the observable.**
Never infer execution from the source file.

```bash
# 1. every tamper: purge, then verify by observation
find . -name __pycache__ -type d -not -path "./.venv/*" -exec rm -rf {} +
uv run python -c "<call the mutated function; print what it sent>"
# 2. prefer size-CHANGING edits ("main" -> "refs/heads/main"), which the cache key can see
# 3. or set PYTHONDONTWRITEBYTECODE=1 / python -B for the whole session
```

Same shape as [[feedback_a_control_validates_the_instrument_never_the_target]]: purging the cache
validates the *instrument*; only calling the function validates that the *target* changed.
Sibling of [[feedback_a_guard_can_be_inert_and_read_as_passing]] and the harness defect in
[[project_nanoclaw_1182_guard_covers_appends_not_innerhtml]] (two `new Function` scopes made a
working guard read as a no-op) — **same failure class in a second language: the harness could not
see the difference, and I read that as the code not making one.**
