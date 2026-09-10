---
name: project_nanoclaw_1183_error_dict_not_raise
description: "nanoclaw#1183 (szihs) slang-mcp blob-sha regression tests — MERGED 787575a3 3m42s after opening, blobs identical by hash. Reviewed INLINE, comment 5242658712. 1🟠 the tested absent-file path is the TRANSPORT path (real 404 RETURNS an error dict, takes the isinstance branch, logs 'Found existing file'); 3🟡. My own instrument defect: a same-BYTE-LENGTH tamper is invisible to CPython's (mtime_sec,size) pyc key."
metadata:
  node_type: memory
  type: project
  originSessionId: 656c2786-3cde-4c85-b868-17fe8fbc46ce
---

# nanoclaw#1183 — "cover the blob-sha lookup that create_or_update_file silently lost"

PR https://github.com/slang-coworkers/nanoclaw/pull/1183, author **szihs**, base **`nv-slang`**,
head **`70c7fa18`**, merge-base `13dabf32` (#1177), **1 file +129/−0** (new
`container/mcp-servers/slang-mcp/test/test_github_create_or_update_file.py`).
**MERGED `787575a3` at 15:18:27Z — 3m42s after opening (15:14:45Z)**, but `ci` completed
15:18:05Z ⇒ **this one DID wait for its checks** (unlike #1182). Blob `be073e3d` identical at
head / merge commit / current `nv-slang` tip ⇒ every finding live. My comment **`5242658712`**
via `gh api repos/.../issues/1183/comments --method POST --input`.

**Routing: INLINE by Main.** Generic `pr_ready_for_review` *"route to the project's
`*-pr-approver`"* string again; nanoclaw is platform-infra with no approver wired and the
slang/slangpy approvers are scoped to compiler-CODE PRs.
[[project_nanoclaw_pr874_webhook_route_approver]], same as #1169/#1182 hours earlier.

## ✅ Body verified by execution — every claim exact

Both tampers reproduce verbatim (caller → shadowing export ⇒ `1 failed, 4 passed`, the named
test; required 5th param ⇒ 2 failed). Suite **100 passed / 5 skipped** at head vs **95/5** at
base — the body's figures are exact, not rounded. `ruff check src/` clean; `ruff check test/`
8 pre-existing errors, none in the new file.

## 🟠⭐⭐⭐ The tested "file absent" path is the TRANSPORT path, not the 404 path

`github_request` (`src/config.py:263-278`) catches `httpx.HTTPStatusError` and **RETURNS**
`{"error": ...}`. Measured through the real stack (only the httpx client stubbed):

```
404 / 403 rate-limit / 500 -> RETURNED dict {'error': 'GitHub API error: N', ...}
directory path             -> RETURNED list [{...},{...}]
ConnectError / ReadTimeout -> RAISED
```

The PR's `test_creating_a_new_file_omits_sha` uses `get_raises=RuntimeError("404 Not Found")`
⇒ it exercises the **only** inputs that reach the bare `except`: transport failures. A real
missing file takes the `isinstance(existing_file, dict)` branch — **an error dict IS a dict**.
Three consequences, all on clean head:

1. Real-404 path **untested and correct only by accident of `.get`** — `PUT keys:
   ['branch','content','message']`, no `sha`.
2. **The log lies the other way now:** real 404 prints `Found existing file, will update it`
   (`github.py:1681`) then `File created successfully`. #1177 inverted which direction the log
   lies rather than removing it — the body's own *"a wrong answer wearing the costume of a
   diagnosis"* still applies.
3. `_get_file_contents_raw`'s docstring (`github.py:1628`) says *"this one RAISES on a missing
   file, which is what the caller's try/except is written against"* — **contradicted by
   execution**. Landed in #1177; **#1183 is what gives that wrong claim a green check.**
   ⭐⭐**A test written against a docstring inherits the docstring's error and launders it.**

## 🟡 Nothing asserts WHICH ref the lookup reads — and my first probe of this was blind

Every assertion is on the PUT; the GET is recorded and only *counted*. Tamper
`params={"ref": branch}` → `{"ref": "refs/heads/main"}` ⇒ full suite **100 passed, byte-identical
to clean**. Plausible route exists in-tree: the GitLab twin (`src/gitlab/gitlab.py:241-249`)
deliberately falls back to the default branch when no ref is given, so a harmonize-the-backends
refactor lands here. 3-way control on a 2-line assertion: clean 5 passed / tampered 1 failed /
restored 5 passed.

⛔⭐⭐⭐**MY FIRST VERSION OF THAT ASSERTION COULD NOT FAIL: `ARGS["branch"]` is literally
`"main"`, and my tamper hardcoded `"main"`.** A fixture whose value equals the likely wrong
answer makes the new assertion a no-op — had to move `ARGS` to `release/1.2` before the control
meant anything. ⇒ **when adding an assertion about a value, check the fixture's value is not
already the failure mode.**

## 🟡 The non-dict test does not pin the guard its docstring names

Deleted `isinstance(existing_file, dict)` outright ⇒ **5 passed**. The `AttributeError` from
`.get` on a list is swallowed by the same bare `except`, so the PUT is identical. The paths *are*
distinguishable (guard present ⇒ no `File does not exist` log; absent ⇒ there is one) but the
test asserts only where they agree.

## 🟡 The arity test: catches nothing test 1 misses, fires on a clean refactor

- Shape **ruff F811 cannot see** (single def, args→pydantic, caller unchanged): `ruff` clean,
  suite `2 failed` — **test 1 catches it alone**. The historical duplicate-def shape ruff *does*
  see: `F811 Redefinition of unused get_file_contents from line 1622`, already the #1177 gate's.
- **Consistent** refactor (helper AND caller converted, behaviour identical): `1 failed` — only
  the arity test ⇒ **false alarm on a legitimate refactor**, and the one test pinned to a name
  against the file header's own stated policy.
- **Under-tight where it claims to be tight:** `*,`-keyword-only params keep
  `inspect.signature().parameters == ["owner","repo","path","branch"]` ⇒ **passes** while the
  caller's positional call breaks. The invariant worth pinning is *caller and helper agree* =
  what test 1 measures.

## ⛔⭐⭐⭐ MY OWN INSTRUMENT DEFECT — a same-LENGTH edit is invisible to the interpreter

`{"ref": branch}` → `{"ref": "main"}` is **32 bytes → 32 bytes**, written in the same mtime
second ⇒ CPython's `(mtime_sec, size)` `.pyc` cache key **could not see it**. Two subsequent
measurements ran **stale bytecode**: `inspect.getsource` reported the restored source while the
loaded code still sent `{'ref': 'main'}`. **The tell was an impossible result** — a test failing
*after* restore, with `git hash-object` proving the blob matched PR head (`3112c531`).
⇒ **a tamper-verification protocol on Python silently reports "the tamper did nothing" for any
byte-length-preserving edit.** Every measurement re-run from clean with
`find . -name __pycache__ -exec rm -rf {} +` between steps and size-changing edits only.
Cheap standing guard: **after applying a tamper, prove it is LOADED** (call the function and
print the observable), never trust the source file.

## Environment notes (mine, not the PR's)

`test_config.py`'s 3 failures are my container: `GH_TOKEN=ROUTED_VIA_ONECLI_PROXY` vs the tests'
literal `github-test-token`. **Identical 3 failures at base** ⇒ baseline control; `env -u
GH_TOKEN` gives the clean 100/95. Worktrees detached (`git worktree add -d <sha>`) so no ref
moved. `uv sync --frozen` in both trees; ruff 0.14.8 / pytest 9.0.2 from `uv.lock`.

**RESUME** = szihs replies to `5242658712` ⇒ the 🟠 is one added fixture
(`get_result={"error": "GitHub API error: 404", ...}`, assert no `sha`) plus a docstring
correction at `github.py:1628`; offer the GET-params assertion with the `ARGS` branch changed.

See also [[project_nanoclaw_1182_guard_covers_appends_not_innerhtml]],
[[project_nanoclaw_1169_fixture_not_verbatim]],
[[feedback_a_control_validates_the_instrument_never_the_target]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
