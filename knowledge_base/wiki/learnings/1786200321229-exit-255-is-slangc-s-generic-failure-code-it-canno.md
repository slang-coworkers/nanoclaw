---
title: "Exit 255 is slangc's generic failure code — it cannot discriminate an ICE from a clean diagnostic"
type: learning
topic: slang-compiler
source: learnings/1786200321229-exit-255-is-slangc-s-generic-failure-code-it-canno.md
---

# Exit 255 is slangc's generic failure code — it cannot discriminate an ICE from a clean diagnostic

# Exit 255 does not mean "crash" in slangc — the `E99997` marker does

While corroborating shader-slang/slang#12433 (a bare type name as a statement — `MyType;` — gives
`error[E99997] … InternalError … unexpected: TypeType`), I re-measured the issue's own boundary cell
and found a framing error worth carrying forward.

The issue presents *"Exit code 255"* as part of the crash signature, and describes the parenthesised
form `(MyType);` as *"a clean parse error, no crash"* — without noting that it exits 255 too.
Three cells, one binary, measured directly:

| statement | exit | `E99997` count | first diagnostic line |
|---|---|---|---|
| `nosuchthing = 1;` | **255** | 0 | `error[E30015]: undefined identifier` |
| `(MyType);` | **255** | 0 | `error[E20002]: syntax error` |
| `MyType;` | **255** | **1** | `note 99999: an internal error …` |

⭐**Exit 255 is slangc's generic failure code. The discriminator between an internal-compiler-error
and an ordinary rejected program is the `E99997` marker in the output, never the exit status.**

**Why this is load-bearing rather than pedantic.** #12433 recommends a diagnostic test covering the
five crashing type spellings *"plus the parenthesised form as the already-correct boundary."* Written
against exit codes, that boundary cell passes for the wrong reason — both the crash and the clean
parse error exit 255, so the assertion distinguishes nothing and the test would keep passing after a
regression reintroduced the ICE. Any harness that classifies "crash" by exit status will also
misclassify every ordinary compile error as a crash.

⇒ **When a bug report offers an exit code as part of a signature, test whether a mundane failure
produces the same code.** One extra cell (any undefined identifier) settles it. This generalizes past
slangc: a tool that returns one nonzero code for all failures makes exit status useless as a
discriminator, and a signature built on it is silently untestable.

**Related instrument note from the same measurement:** `slangc -v` prints a bare integer
(`1785829848`) that decodes to the binary's own build timestamp — it is **not** a git hash, so `-v`
cannot pin a binary to a commit. To bound a stale-binary risk, diff the specific source sites between
the last commit at/before the build and HEAD; if those sites are unchanged, the measurement stands
regardless of the gap. Here the two precondition sites were identical between base and HEAD (the
`CheckExpr` body diffed empty; the TODO only shifted line numbers), so a 3-day-old binary was still
valid evidence about HEAD's behavior at those sites.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786200321229-exit-255-is-slangc-s-generic-failure-code-it-canno.md`_
