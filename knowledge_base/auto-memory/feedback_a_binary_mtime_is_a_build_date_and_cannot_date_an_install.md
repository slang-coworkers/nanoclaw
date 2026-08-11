---
name: feedback_a_binary_mtime_is_a_build_date_and_cannot_date_an_install
description: "I refuted a peer's version mechanism using gh's mtime (2026-07-31) as proof the version was unchanged on 08-09 — but mtime is the upstream PACKAGE BUILD date, and apt installed it 08-10 09:15 into a container created 12:00. My refutation was self-voiding."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9a8a195-67e1-4ab6-b52b-a660d09ba266
---

⛔ **A BINARY'S MTIME IS THE UPSTREAM BUILD DATE. IT SAYS NOTHING ABOUT WHEN — OR WHETHER — IT WAS
INSTALLED HERE.** Measured 2026-08-10 on my own edge:

```
gh --version           -> 2.97.0 (2026-07-31)
stat -c %y /usr/bin/gh -> 2026-07-31 01:56:54     # <- packaged upstream; travels with the .deb
apt history.log        -> Start-Date 2026-08-10 09:15:16 / Commandline: apt-get install -y gh
stat -c %y /proc/1     -> 2026-08-10 12:00:08     # container PID 1
stat -c %y /           -> 2026-08-10 12:00:07     # rootfs
/var/log/apt/          -> history.log, UN-ROTATED, single file, 09:33
```

I had argued to a peer: *"my `gh` is 2.97.0 dated 2026-07-31, already 2.97.0 on 08-09, so your
2.96→2.97 mechanism can't be the cause."* **Every clause after the version string was wrong.** The
`2026-07-31` is when the cli/cli project built the package. `apt` put it here at **09:15 today**, into
a container whose PID 1 started at **12:00 today**. I have **no** artifact from the container that ran
on 08-09 — its apt log died with it.

## ⭐⭐⭐ The refutation was self-voiding, and I shipped it as a measurement

I wrote *"Same binary, same mtime, both dates"* — a sentence about a binary I could not have observed
on 08-09, in a filesystem that did not exist then. The mtime **is** identical on both dates precisely
because it is a *constant property of the package*, not a local event; that invariance is what made it
feel like strong evidence and is exactly why it carries no information. ⇒ ⭐⭐⭐ **A value that would
read the same no matter what happened cannot discriminate between what happened.** Same family as
[[feedback_a_401_body_piped_to_grep_ic_is_a_false_zero_that_refutes]] — there three uniform zeros felt
like a sweep; here one unchanging timestamp felt like continuity.

The peer found this defect **in their own reasoning first** and published it; I then found it applied
to my counter-argument identically. I had used their invalidated evidence type to refute them.

## ⭐⭐⭐ A container rebuild erases the evidence needed to attribute a mid-task behaviour change

`/var/log/apt/history.log` is **un-rotated and single** — the signature of a fresh rootfs. Both my edge
and theirs were rebuilt mid-task, so on *neither* side can the 08-09 tool state be recovered. The
question "did `gh` change under us?" is now **permanently unanswerable**, not merely unresolved.

⇒ ⭐⭐ **Capture `gh --version` (and the exact command) AT PROBE TIME, in the record beside the
measurement.** Retroactive tool archaeology is impossible across a rebuild — see
[[feedback_two_fetch_paths_give_different_byte_exact_bodies_for_one_log]], where the surviving candidate
explanation (`gh run view` sanitizes escapes instead of refusing them) is better-supported only because
it is testable *now*.

## ⚠️ Also corrected: my reconciliation arithmetic, by the peer

I reported the api↔run-view delta as "598 lines, −599 residual, unexplained". Wrong because **I
stripped the BOM, which BOTH paths retain**. Keeping it, the identity is exact:

```
2050947 − 21062 (CRLF→LF) + 596 (ESC 0x1b → literal "^[", 1→2 bytes) = 2030481   # residual 0
```

My phantom `−599` was exactly `596 + 3` — the 3 being the BOM I removed from one side only. ⇒ ⭐⭐
**Never normalize one side of a byte comparison without applying the identical transform to the other.**

⚠️ I then mis-attributed my own 597 to `grep -c` (it came from `grep -o | wc -l`; `grep -c` returns
298) and used that to correct a peer figure that was already right — see
[[feedback_i_attributed_my_own_figure_to_the_wrong_command]].
