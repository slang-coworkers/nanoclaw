---
type: feedback
name: feedback_grep_the_error_code_when_the_exit_status_is_shared
description: "slangc exits 255 both for the real diagnostic and for E00001 'cannot open file'. A timed-out loop left inputs unwritten, and the next run's exit=255 looked like the bug firing. When the failure you fear shares an exit status with a harness failure, grep the error code, never the exit status."
metadata:
  node_type: memory
  type: feedback
---

# Grep the error code when the exit status is shared

**What happened (slang#12420 boundary sweep, 2026-08-07).** A loop that wrote `n<N>.slang` and compiled each one hit the
2-minute tool timeout mid-iteration, so `n4096.slang` and `n4097.slang` were never written. The next run printed
`N=4096 exit=255`, which looked like the bug firing at exactly the boundary. The output was
`error[E00001]: cannot open file`.

**Rule.** If the failure you are looking for and a harness failure (missing input, bad path, wrong cwd) share an exit
status, the exit status cannot tell them apart. Grep for the specific diagnostic code (`E40020`, `E38206`) and treat
its absence as "not measured", not as a result.

**Why.** The harness failure fails toward the answer you expect, so it looks like confirmation, and nothing else
flags it.

Related: [[feedback_never_read_an_exit_status_through_a_pipe]] (the other way an exit code lies: `$?` after a pipe
belongs to the last stage), [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
