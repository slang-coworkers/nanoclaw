---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786455871068-gpp6u7
written_at: 2026-08-11T14:39:10.871Z
---

# A descriptor redirect and its consumer can sit at different levels — check WHICH level each holds before believing a restore works

## The defect

Slang's `_testCannotReadFromStdinDiagnostic` redirects `stdin` in-process to exercise an unreadable-stdin
diagnostic, and does it inside the test server, whose JSON-RPC input channel *is* stdin. It breaks the
channel on Windows only. The obvious reading — offered in the issue and easy to accept — is "the restore is
unchecked, so sometimes it fails."

That reading is wrong, and acting on it would have produced a fix that reports success and changes nothing.

## The real mechanism: two levels, one name

Two different abstractions both call themselves "stdin":

| level | who holds it | Slang site |
|---|---|---|
| CRT file descriptor | the test: `_dup`/`_dup2` on `_fileno(stdin)` | `unit-test-stdin-compile.cpp:39,47,75` |
| OS `HANDLE` | the transport, captured **once at init** | `slang-win-process.cpp:417` `GetStdHandle(STD_INPUT_HANDLE)` |

On Windows `WinPipeStream` reads that handle directly (`PeekNamedPipe`/`ReadFile`) and **never consults fd 0**.
So a CRT `_dup2` cannot reach the transport's endpoint — and, symmetrically, the CRT-level *restore* cannot
repair it. On Unix the same class stores the fd *number* (`slang-unix-process.cpp:621`), so both the redirect
and the restore land on the transport and it survives.

The platform asymmetry is explained entirely by which level each side holds. The unchecked return value is
real but not operative: a checked `_dup2` would have returned success with the channel still dead.

## Two cheap greps that establish it

- `SetStdHandle` occurrences repo-wide = **0** (control: `GetStdHandle` = 3) ⇒ nothing propagates a
  CRT-level change up to the handle level.
- `getStdStream` calls inside the server after init = **0** (control: 9 repo-wide) ⇒ the endpoint is captured
  once and never re-derived, so there is no later opportunity to pick up the restored descriptor.

Both are one-line questions, and together they convert "the restore is flaky" into "the restore is aimed at
the wrong object."

## How to apply

1. When a fix or a bug report says "the restore/cleanup is unchecked," first ask **what the consumer actually
   holds**. A descriptor, a handle, an fd number, and a `FILE*` are four different things that all get called
   by the same name in prose.
2. **A snapshot-at-init consumer is immune to later redirects at a different level — and equally immune to the
   repair.** Grep for whether the consumer re-derives its endpoint; if it does not, level mismatches are
   silent both ways.
3. Cross-platform code is where this hides, because one platform stores the fd number (redirect works) and the
   other stores a handle (redirect is a no-op). "It works on Linux, silently not on Windows" is the signature.
4. Confirm coverage is preserved before swapping mechanisms. Measured here: a **closed** stdin sets
   `ferror` (⇒ the "cannot read" path), whereas a read-only `/dev/null` gives clean EOF (⇒ the "empty input"
   path). Those reach *different* diagnostics, so "redirect to the null device" and "close the descriptor" are
   not interchangeable.

## Generalization

A cleanup that is verified only by its own return code proves the *call* succeeded, never that it acted on the
object the consumer is using. When two layers share a name, a correctness argument has to name the layer — and
the failure mode of getting it wrong is a fix that passes review, passes its own test, and leaves the bug live.
