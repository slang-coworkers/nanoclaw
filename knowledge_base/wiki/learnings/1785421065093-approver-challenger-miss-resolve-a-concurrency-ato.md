---
title: "[approver/challenger-miss] Resolve a concurrency-atomicity gap by reading the dependency's source at its pin, not by guessing — fmt::print is per-line atomic"
type: learning
topic: review-approval
source: learnings/1785421065093-approver-challenger-miss-resolve-a-concurrency-ato.md
---

# [approver/challenger-miss] Resolve a concurrency-atomicity gap by reading the dependency's source at its pin, not by guessing — fmt::print is per-line atomic

**Symptom:** slangpy#1081 "Logger deadlock fix" moved `output->write()` outside
`Logger::m_mutex`. CodeRabbit raised a 🟠 Major: concurrent writes to a shared
built-in output (Console/File → stdout/stderr/FILE*) with no per-output lock
"can interleave." At R0 I couldn't confirm/deny whether concurrent writes garble
output, so I abstained (ABSTAIN_POLICY/OPEN_GAP) — correct given the uncertainty,
but the uncertainty itself was resolvable and I hadn't resolved it.

**Root cause of the abstain:** The atomicity question depends entirely on the
logging library's write path, which I hadn't read. Guessing either way (clear =
false-safe risk; block = false-positive) would have been unjustified.

**How to resolve it (the transferable technique):** For "can concurrent calls to
this sink corrupt output?" questions, read the sink library's source AT THE
VERSION THE REPO PINS. slangpy pins fmt via `external/.gitmodules` →
`fmtlib/fmt@40626af88bd7` = FMT_VERSION 110200 (v11.2.0). In
`include/fmt/format-inl.h`: `vprint_buffered` formats the entire line into a
`memory_buffer` then calls `detail::print` → `fwrite_all` → a SINGLE
`std::fwrite`; the buffered-FILE* fast path (`vprint` when
`is_buffered()`+`has_flockfile`) holds `flockfile` across format+write. So each
`fmt::print(FILE*, ...)` reaches the stream as one locked stdio op, and C/POSIX
stdio locks the FILE per op → **each log message is byte-atomic; concurrent
writes cannot garble a line, only reorder whole lines** (benign for any
concurrent logger). NB the token is a repo-scoped app token — cross-org `gh api
repos/fmtlib/fmt/...` 401s; fetch raw source via
`raw.githubusercontent.com/<org>/<repo>/<sha>/<path>` (WebFetch, no auth).

**Scope honestly (a critique caught me over-generalizing):** the atomicity proof
covers the POSIX/buffered-FILE* paths. The Windows console path is
`fflush`+`WriteConsoleW` (two ops) and `DebugConsoleLoggerOutput` uses
`OutputDebugStringA` — I did NOT trace those to per-message integrity. State them
separately: "no memory-unsafety path identified; per-message integrity unproven
on Windows." Don't let "atomic on the path I read" silently become "atomic
everywhere."

**Outcome / calibration:** Resolving the uncertainty flipped R0 abstain →
R1 WOULD_APPROVE (the synchronize was doc-only — logger.h contract wording, .cpp
byte-identical — so the flip came from completing the investigation, not a code
change). Human MEMBER approved the same head and the PR merged — my
WOULD_APPROVE agreed. Lesson: an abstain on a *resolvable* dependency-behavior
question is a deferral, not a verdict; the next reviewer of a "moved work outside
a lock" change should go read the callee/sink source before either clearing or
blocking. Also: releasing a lock around a callback is safe only if the shared
state the callback touches is independently synchronized (here: stdio's per-FILE
lock + atomic `Object::m_state` refcount for the snapshot).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785421065093-approver-challenger-miss-resolve-a-concurrency-ato.md`_
