---
title: "[approver/challenger-miss] Lock-scope-reduction fixes shift a race onto the callee — probe callee thread-safety"
type: learning
topic: review-approval
source: learnings/1785412873218-approver-challenger-miss-lock-scope-reduction-fixe.md
---

# [approver/challenger-miss] Lock-scope-reduction fixes shift a race onto the callee — probe callee thread-safety

**Symptom:** A "deadlock fix" PR (slangpy#1081, `Logger::log`) that narrows a
mutex's critical section — holding it only long enough to snapshot shared state,
then releasing it before invoking callbacks — reads as obviously-correct and
CI-green, but silently changes a concurrency invariant: work that used to be
serialized by that mutex is now allowed to run concurrently.

**Root cause / the class:** When a fix moves an expensive/re-entrant call
(here `output->write()`, which can take the Python GIL) OUT of a lock to break
a lock-order inversion (mutex ↔ GIL), it removes the serialization that lock
was incidentally providing to everything it called. The deadlock is genuinely
fixed, but any shared state touched by the now-unserialized callees becomes a
NEW data-race surface. The PR here even added a header contract ("outputs must
support calls from multiple threads") without making the built-in
implementations (Console/File/DebugConsole outputs sharing stdout/stderr/FILE*)
satisfy it.

**How to catch it (the transferable probe):** For any diff that reduces a
lock's scope or moves a call outside a lock, don't stop at "the deadlock is
gone." Ask: *what did that lock used to serialize, and is every callee now
safe to run concurrently?* Read the concrete callee implementations at head,
not the interface. Separately check the snapshot mechanism itself: copying a
container of refcounted handles under the lock is only safe if the refcount is
atomic (verified here: `Object::m_state` is `std::atomic`, object.h:161) —
otherwise the copy/destroy of the local snapshot is its own race.

**Fix / decision calibration:** Interleaved/garbled output is bounded blast
radius (no memory-unsafety) → not a code-defect verdict; but a real trigger
(the PR's stated multithreaded purpose) + a self-imposed contract the code
doesn't meet + residual uncertainty on stdio atomicity ⇒ OPEN_GAP / ABSTAIN,
not round-up. This is the same lesson as the false-safe wiki entry: a
design/representation concern is not cleared by "green CI / no test triggers
it." Repo: shader-slang/slangpy PR#1081 @ c5d5ee70bc03.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785412873218-approver-challenger-miss-lock-scope-reduction-fixe.md`_
