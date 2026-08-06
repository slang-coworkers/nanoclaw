# PENDING — awaiting operator approval. Not applied.

**Change:** add the `append_learning` read-back rule to the coworker spine (affects every coworker on
next wake). **Authorization required: operator.** A peer (`slang-triager`) recommended it and I declined
to treat that as approval — a spine edit has fleet-wide blast radius and peer-authorizes-fleet-edit has
no natural stopping point.

**Where:** the `append_learning` section of the base coworker spine (alongside the existing
send_message / send_file / add_reaction descriptions), not in any per-project spine.

## ⛔ Disqualifying case for THIS change — written before anyone claims it is warranted

*(Habit adopted 2026-08-05 after a gate phrased as an unbounded predicate — "a second independent
incident", never saying of what — was misapplied within the hour by its own author. An unbounded predicate
is invisible until something satisfies it wrongly, so gating language cannot be audited in the abstract,
only against attempted uses. ⇒ **Write the gate's disqualifying case alongside the gate.**)*

**This change is warranted by:** a coworker citing a shared learning as published when the file does not
exist, or exists with different content than claimed — i.e. a **write that silently failed** while the
close-out read as complete.

**It is NOT warranted by:**
- **A false `0/0` on a file that does exist.** Seven measured sources produce that symptom — recalled
  needle, peer's paraphrase, vocabulary rename, own tool output, prose-against-a-table, truncation, unicode
  lookalike — and **none is a write failure.** The disqualifying check: `ls` shows the file. If it is
  there, the defect is in the probe, and this rule would not have helped.
- **A coworker not knowing whether its write landed.** That is the *pre-existing* condition this rule
  addresses, not an incident. An incident requires an actual divergence between claim and artifact.
- **Fragmentation across per-group and shared stores** (a finding recorded privately and reported as
  filed). Related and real, but a different defect: the write succeeded, to the wrong store. That argues
  for a *store-selection* rule, not a read-back rule.

**Vocabulary that must be present in any evidence offered:** the file's absence from `ls -t`, or a
content mismatch shown by opening it. Absent those, the claim is about probe hygiene, not about writes.

---

## Proposed text

> **`append_learning` returns a submission acknowledgement, not a write confirmation.** Before citing a
> learning as published — in a close-out, a report, or a claim that a rule is now shared —
> **verify the file exists and grep an interior fragment.** Not "confirm the write succeeded": you can
> close the **existence** half yourself, but only a write-capable agent can **repair**, and conflating the
> two produces an escalation per learning, which trains the flag to be ignored.
>
> ```
> ls -t /workspace/shared/learnings/*.md | head -3
> ```
>
> **Then match a fragment — and a zero here has three distinct causes with three different repairs.**
> Do **not** trust a bare `grep`:
>
> | zero | means | repair |
> |---|---|---|
> | **0 raw / 0 normalized** | your **needle** is wrong — recalled, not lifted | re-read the file and copy the fragment out of it |
> | **0 raw / 1 normalized** | your **grep** is wrong — wrap, case, emphasis, unicode, or dashes | normalize both sides |
> | 0 everywhere, file absent from `ls` | the write really failed | escalate (see below) |
>
> ⭐ **`0/0` is the dangerous one: it reads as a definitive absence.** `0/1` merely looks like a bad
> query. Measured 2026-08-05 — needle `'cannot distinguish a live rule'` returned 0 raw **and** 0
> normalized because it was invented from a summary; the file says "cannot *tell* a live rule". One word.
>
> ⚠️ **A `0/0` does NOT always mean the needle was recalled — line-prefix markup is a sixth axis the
> canonical 5-axis normalizer does not cover.** Measured while verifying this very draft: the needle
> `'FileCheck patterns, not wikilinks'` returned 0 raw and 0 normalized, yet the text is present. Cause:
> the phrase spans a line break inside a **blockquote**, so after whitespace-collapse the stored form is
> `extra are filecheck > patterns, not wikilinks` — the `> ` marker is *interior* to the phrase.
> Same hazard for `- `, `* `, `# `, and any wrapped list item. ⇒ **Strip line-leading markup before
> collapsing**, e.g. `re.sub(r'(?m)^[>\-*#\s]+', ' ', s)` ahead of the canonical normalize, or match a
> short single-line stem instead of a spanning phrase. **A `0/0` on text you can see means your
> normalizer is missing an axis, not that your needle is wrong.**
>
> **For the normalizer, use the canonical recipe — do not hand-roll one, and do not use
> whitespace-collapse alone.** `/workspace/shared/learnings/1785962056195-a-false-zero-on-a-shared-file-manufactures-an-accu.md`
> (with its correction `1785962321997-…`) carries the measured 5-axis form: NFKC · casefold ·
> emphasis/ticks `[*`~]+` **excluding `_`** · dash variants · whitespace. Every axis beyond whitespace
> was measured to fire on real corpora — NFKC rewrites **253 of 655** files, dash variants occur
> **18,124** times across all 655 — and stripping `_` is a filed defect that silently mangles wikilinks
> and slugs.
>
> ⚠️ **The `_` carve-out is not inert here, contrary to a first reading.** Measured 2026-08-05, each
> figure with its instrument:
>
> | population | figure | instrument |
> |---|---|---|
> | `learnings/*.md` filenames containing `_` | **17 of 2,992** | `ls *.md \| grep '_'` — all 17 are wikilink-shaped `legoop-*` slugs plus `dashboard_*` |
> | bodies with a wikilink-shaped `[[a_b]]` needle | **63** at 22:33:49Z | `grep -lE '\[\[[a-z]+_[a-z_]+\]\]'` |
> | bodies with any `_` inside a `[[…]]`-shaped match | **78** at 22:33:49Z | `grep -rl '\[\[[^]]*_'` |
> | memory-namespace filenames containing `_` | **715 of 751** | same `ls \| grep` |
>
> **The 63-vs-78 gap is not arrival and not aperture-on-the-same-thing** — the 15 extra are **FileCheck
> patterns, not wikilinks** (e.g. `[[CNT:_S[0-9]+]]` in a SPIR-V test snippet). In basic `grep`,
> unescaped `[[` is a *bracket expression*, so `'\[\[[^]]*_'` matches a single literal `[` followed by
> `_`, which FileCheck captures satisfy. Both numbers are correct measurements of *different*
> populations; only 63 counts wikilinks. ⇒ **When two agents' figures for "the same" quantity differ,
> the first hypothesis is that they are measuring different populations — check the pattern's semantics
> before attributing the gap to timing.**
>
> Either way the conclusion is unaffected: "learnings are all-hyphenated, so the carve-out doesn't
> apply" is **false**, with a 17-filename plus 63-body blast radius. It is far more load-bearing in the
> memory namespace, and it is exactly the scope detail a restatement drops.
>
> **Grep an interior fragment, never the title.** Slugs are truncated at 50 characters, so a needle from
> a title's tail can never match. Measured 2026-08-05 across nine readings of a *moving* corpus by three
> agents on independent mounts — always written `total=… pile=…`, never bare, because the series is the
> evidence:
>
> | when | total | pile (stems == 50 chars) |
> |---|---|---|
> | ~22:04Z | 2968 | 2909 |
> | ~22:05Z | 2969 | 2910 |
> | ~22:18Z | 2976 | 2917 |
> | 22:19:59Z | 2977 | 2918 |
> | 22:24:32Z | 2985 | 2926 |
> | 22:26:59Z | 2986 | 2927 |
> | 22:29:59Z | 2991 | 2932 |
> | ~22:31Z | 2992 | 2933 |
> | 22:31:29Z | 2992 | 2933 |
>
> **Every consecutive pair moves one-for-one** (+9/+9, +1/+1, …), so the cap is **live**, not historical
> residue: every newly-arriving file lands truncated. A title-tail needle is therefore unmatchable for
> ~98% of the corpus and would report a successful write as a failure — on the very check meant to catch
> failures.
>
> ⚠️ **Write these as `total=N pile=M`, never as `M/N`.** One reading in this series was published
> pile-first and only survived because `pile ≤ total` is an invariant that makes the reverse reading
> impossible. **That is notation rescued by an invariant, not by its label** — the rescue fails as soon
> as the two numbers are close, or a reader quotes one alone.
>
> **You can close the existence half yourself; you cannot repair.** `/workspace/shared` is mounted
> read-only for coworkers and read-write only for the admin orchestrator (Main), which holds the sole
> writable mount. So if the file is missing, or is present but wrong, the escalation target is
> specifically **Main** — not a generic "escalate upstream." Say what is missing and quote the fragment
> you grepped for.
>
> Do not escalate on every learning. A silent failure leaves the lesson nowhere while your close-out
> reads as complete; that is the case this check exists for.

---

## Provenance

- Rule and its better framing: `slang-fixer`, which disproved my claim that coworkers *cannot* verify a
  write (`ro` blocks writes, not reads — read-back was always available to them). That was instance #8
  of the evening's mechanism: a mount flag read as a proxy for the directory.
- "Verify existence and grep an interior fragment," not "confirm the write succeeded" — `slang-triager`.
  Conflating existence with repair produces an escalation per learning and trains the flag to be ignored.
- The 50-char truncation trap — `slang-triager`, reproduced independently on both edges (2,909/2,968 here;
  2,910/2,969 there; every >50 stem predates `1782270000000`, an older naming policy).
- The escalation-target-is-Main asymmetry — `slang-triager`, and it is the one piece a coworker cannot
  derive from its own edge: from inside a `ro` mount you can see that you can't write, not who can.

## What I deliberately did NOT include

- **Any claim that `ro` follows from the mount shape.** It does not. `shared`'s subpath carries no
  agent-group segment, so it is one host directory for the fleet — but the mode is a per-container
  mount-time flag. Measured: `/proc/mounts` reports `/workspace/shared` **`rw`** on my edge (touch
  probe succeeds), **`ro`** on the triager's (touch fails). The rule rests on that direct probe plus the
  single-host-directory fact, not on an inference from the path.
- **The ack-routing `[MUST]`.** Held at per-group scope (`/workspace/agent/.instructions.md`) until a
  second independent incident. One incident, one topology, and a wrong routing default fails as
  invisible silence across every coworker.

  ⛔ **The gate names a DEFECT CLASS, not an incident count — "a second independent incident" was
  ambiguous and I misapplied it within the hour.** The gating condition is specifically a second
  **routing/addressing** failure: *a message reaching a session that is not the one holding the work*
  (the original: a thread-less ack minted a phantom session that received the ack and never the dispatch,
  then reasoned from a partial inbox).

  **It is NOT satisfied by an echo/terminal-turn failure.** Measured 2026-08-05 on the file documenting
  the 10-message echo incident: `thread_id` → 0, `phantom` → 0, `ack-routing` → 0, `canonical thread` → 0,
  `partial inbox` → 0, while `silent hold` → 7, `echo` → 6, `terminal turn` → 2. Those ten messages were
  **correctly addressed and correctly routed** — they landed in exactly the intended session. They were
  *unnecessary*, not *misrouted*.

  ⭐⭐ **Same symptom family (unwanted delivered rows), different mechanism (content policy vs. transport
  addressing) — and counting one toward the other is a near-miss on the CATEGORY, the boundary type that
  lets an unrelated event authorize a change.** Version / unit / scope / arrival were the four measured
  boundaries; **category** is this one, and it is the most dangerous because its output is an
  authorization rather than a wrong number.

  ✅ **Any future "the gate is met" claim must name the mechanism and show the routing vocabulary
  present.** A peer caught this one; the check is one grep.
