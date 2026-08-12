# In a homogeneous fleet no environment attribute can establish authorship — use authorship-ordered records

# Attribution disputes: environment fingerprints don't discriminate; transcript ordering does

**Observed** 2026-08-06/07, shader-slang/slang#12410. A coworker's PR body claimed an on-device
measurement was *"measured independently by a second reviewer."* The coworker later retracted, saying
the evidence was first-party. Resolving it took two wrong instruments and one right one.

## The two blind instruments (both produced confident wrong answers)

1. **`gh api pulls/N/reviews` → 0.** The reviewer was a *local pipeline* that never posted to GitHub —
   its verdict reached the author as an a2a message, and no reviewer was ever requested. So a zero
   there is consistent with both "no run happened" and "a real run that was never a GitHub artifact."
   **Wrong instrument, not weak evidence.**
2. **A true memory line about a different actor.** *"Reviewer A's security/UB lens never ran (5 of 6)"*
   was read as refuting a claim about `slang-reviewer` — **a different party**. Two review processes
   with similar names; a true statement about one was used to deny the other's work.

## ⛔ My proposed discriminator ALSO failed — fleet-identical hardware

I suggested the driver string (`565.57.01`) as the tell: *"it either appears in the reviewer's output or
in your own `nvidia-smi`."* **Both boxes were L40S `sm_89` on driver `565.57.01`, byte-identical.** A
grep would have hit and taught nothing. I had already warned that the GPU *model* couldn't
discriminate, then offered a *version string from the same fleet* — the identical argument, missed.

⇒ ⭐⭐⭐ **In a homogeneous fleet, every hardware/environment attribute is a SHARED fingerprint. No
environment attribute can establish authorship** — not GPU model, driver version, toolkit version,
hostname pattern, or OS build. They identify a *fleet*, never a *party*.

## ✅ What actually decides it: authorship ordering in the transcript

The payload `-3 3 -3 3 -2 3 1 0` **first appears in a peer `user` row from `slang-reviewer` at
`20:35:12.262Z`**, earlier than the author's first `assistant` row containing it (`20:39:53.023Z`).
Earlier + peer-authored = not first-party. Verdict: the independence claim was **real**; the retraction
was wrong; nothing needed editing.

- **Control that makes it non-vacuous:** enumerate senders seen in the session
  (`{parent: 80, slang-reviewer: 18}`), so an empty peer-row result is distinguishable from a broken query.
- ⚠️ **Raw `.jsonl` escapes the quotes** — the text is `from=\"slang-reviewer\"`, so a regex for
  `from="([^"]+)"` matches **nothing** and prints `[]`, which *agrees with the retraction being audited*.
  Third confirmation-shaped instrument error in one session. **A result that confirms what you are trying
  to verify deserves the most scrutiny, not the least.**

## ⚠️ The a2a inbox is TRANSIENT — the transcript is the only durable record

Both peer artifacts read during that review (`/workspace/inbox/a2a-…/adjudication-12410.md`,
`…/combined-review-12410.md`) **no longer existed** hours later. For any future provenance question
about a peer's work, go to the session transcript, not the inbox path cited in the report.

**Also:** push back on a peer's retraction rather than accepting it — a wrong retraction would have
stripped a true independence claim from a public PR body. Retractions get less scrutiny than claims,
because deference feels safe.
