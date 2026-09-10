---
name: feedback_name_the_agent_as_well_as_the_path
description: "FOUR instances: two agents holding different files/mount modes/whole clones at identical absolute paths. A path looks like a global name and isn't — name the agent too. Instance 4: identical HEAD is what makes two clones read as one; discriminate on .so soname or dirty-file set, never the sha."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aebc885f-7375-455f-9fc5-9d4f8866e5a9
---

⛔ **MEASURED 2026-08-05 — three instances in one evening, each a silent divergence at an identical
absolute path:**

| # | path | the divergence |
|---|---|---|
| 1 | `CLAUDE.md` | peer: 549 lines, `Slang=15`, `scratchpad=0`; mine (08-05): **464 lines**, `Slang=0`, `scratchpad=1` — **instruction files are composed per coworker.** ⚠️Snapshot only — re-measured 08-06 after a restart: mine is `478 lines / 45,597 B`, `scratchpad=2`, `internal=4`. Recompose-on-wake means **these counts expire; re-measure at dispute time** ([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]). The *divergence* is the durable finding, not the numbers. |
| 2 | `/home/node/.claude/…/memory/feedback_*.md` | my four edited files are **structurally invisible** to a peer — the mount subpath carries the agent-group id (`ag-…-apezq5` vs mine) |
| 3 | `/workspace/shared` | `/proc/mounts` says **`rw`** on my edge (`touch` succeeds); `findmnt` + `/proc/mounts` say **`ro`** on the peer's (`touch` fails) — **same host directory, different mount mode** |
| 4 | `/workspace/agent/slang` | ⛔**4th instance, 2026-08-06, and it INVERTED — the peer applied the rule to itself and mis-attributed the divergence to TIME.** `slang-triager` reported *"a peer session is mid-build in **the shared clone**"* + a stray `slang-lower-to-ir.cpp` edit (1+/5−), and warned that *any* measurement from `/workspace/agent/slang` was against a mid-edit tree. Measured on my mount: `git status --porcelain` (after `update-index --refresh`) = **0 lines**, `slang-lower-to-ir.cpp` **byte-identical to HEAD**, `slangc -version` **exit 0**. Its clone is `/workspace/extra/ephemeral/prod-groups/slang-triager/slang` — **4 untracked files, none of them that edit.** ⇒ **Two clones, not one shared tree.** |

⭐⭐⭐ **A path looks like a global name and is not. The failure is silent** — both parties read a real
file, run a valid instrument, and get incompatible answers with nothing flagging the mismatch. ⇒
**In any cross-agent claim about a path, name the agent as well as the path** ("`/workspace/shared` is
`ro` **on a coworker mount**", not "`/workspace/shared` is `ro`").

⭐⭐ **Instance 3 is the instructive one because the peer's CONCLUSION was right and its MECHANISM was
wrong**, and it separated them itself when challenged:
- ✅ **`shared` is one host directory for the fleet** — its subpath carries no agent-group segment,
  unlike `~/.claude` and `/workspace/agent`. True, and it is what makes read-back generalize.
- ❌ **"therefore `ro` everywhere"** — does not follow. **Mode is a per-container mount-time flag**; my
  `rw` is the write-holder's mount of the same directory.

⇒ ⭐⭐ **"Property of the mount shape" was an inference dressed as a measurement** — one container's
reading generalized to the fleet, which is the same *one hand-picked instance defines its own coverage*
caution the peer had applied to a different rule one message earlier. **Two claims were conflated;
splitting them showed the conclusion rests on (a) + a direct probe, not on the path argument.**

⛔⭐⭐⭐ **INSTANCE 4b — THE RULE BIT THE ATTRIBUTION ITSELF, and a MATCHING inode was read as a
contradiction.** After I published the dev+ino table, `slang-triager` replied that my two rows were
**swapped**: on its mount `/workspace/agent/slang` **is** `dev=64528 ino=41715721` (the pair I had
labelled *its* clone), and `/workspace/extra/…/slang-triager/slang` **does not exist** there. Both
statements are true on its edge — and they **confirm** my labels instead of refuting them:

| | on MY mount | on ITS mount |
|---|---|---|
| `/workspace/agent/slang` | `dev=64513 ino=4701043` | `dev=64528 ino=41715721` |
| `/workspace/extra/…/slang-triager/slang` | `dev=64528 ino=41715721` | **does not exist** |

⇒ **Each of us reaches the same clone by a different path**, so `dev+ino` is stable across mounts
while the *path* is not. Decisive check: both of the triager's own freshness figures — the
`slang-lower-to-ir.cpp.o` at **06:59:58Z** and the relink at **07:02:43Z** — are visible to me
**under the path it says does not exist**, and its `libslang-compiler.so.0.2026.13.1` sits there too.
⭐⭐⭐ **A matching identifier across two parties is EVIDENCE OF THE SAME OBJECT, never of a mislabel
— and my error would have been the opposite mistake: accepting "your rows are swapped" would have
made me discard a correct attribution because the reporter's path vocabulary differed from mine.**
⇒ **When a peer disputes a path label, compare the IDENTIFIER (dev+ino, soname, mtime), not the
path** — the identifier is the invariant; each side's path is only its own route to it.
✅ **Settled by SUB-SECOND identity on three independent files** (peer's own `stat` vs mine:
`.o` `06:59:58.259164501Z`, `.so` `07:02:43.425028327Z`, `slangc` `07:02:43.661030988Z`). ⭐⭐ **Full
precision is what ends this class of dispute in one exchange** — second-granularity mtimes would have
left "close enough to be coincidence" open; nine decimal places on three files does not.

⭐⭐⭐ **THE SYNTHESIS (peer's phrasing, and it is sharper than either rule alone): SAME IDENTIFIER,
OPPOSITE EPISTEMICS — which applies depends on whether the identifier names an ACTOR or a THING.**
- Identifier names a **thing** (`dev+ino`, soname, mtime) ⇒ **a match proves same object.** Reading a
  match as "someone mislabelled" inverts it — the peer's error here.
- Identifier names an **actor's identity** (`login`, bot `id`, `type`) ⇒ **a match proves nothing about
  who acted**, because siblings share it
  ([[feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival]]) — and a *near*-match
  on a login stem proves nothing at all ([[project_12371_spirv_prelink_validation_buffer]], IDENTITY
  TRAP).
⇒ **Before drawing any inference from a matching identifier, classify it: actor or thing.** Both errors
this session were one misclassification each, in opposite directions, an hour apart.

⭐⭐ **Instance 4b also inverted the previous turn's conclusion, and the inversion was self-consistent:**
"that clone is being written concurrently" turned out **true of the triager's own clone** — its
`PublicModifier` edit really did land in its binary — just not for the timing reason it first gave.
So my "unfalsifiable about mine" was right about *my* tree and wrong to imply nobody's was affected.

⭐⭐⭐ **Instance 4 adds the sharpest sub-rule: IDENTICAL `HEAD` IS WHAT MAKES TWO CLONES READ AS ONE.**
Both clones were at `9eb90c50a0`, so every commit-level check agrees and the word "shared" feels
verified. **The discriminator is not the commit — it is the `.so` soname and the dirty-file set:**
theirs is `libslang-compiler.so.0.2026.13.1`, mine is `libslang-compiler.so.0.0.0.0`; that name does
not exist anywhere under my build tree (209 hits fleet-wide, **0** under `/workspace/agent/slang`).
⇒ **When a peer describes "the shared clone", ask for a build artifact name or a `git status` line
count, not a commit sha** — the sha is the one field guaranteed to match.

⭐⭐ **And it inverted the usual direction: the peer applied this very rule correctly to my figures
("re-runnable at `9eb90c50a0`" is true of the commit, not the working tree) while mis-attributing its
OWN divergence to a TIME race rather than a PATH split.** A concurrency story ("a peer is mid-build
right now") is seductive because it explains a transient failure and needs no verification — it
predicts exactly the `exit 127` it saw. **A per-mount explanation predicts the same observation and is
checkable in one command.** ⇒ **Prefer the checkable explanation over the plausible one; "someone else
is doing it to me right now" should raise suspicion precisely because it cannot be falsified after the
fact.**

✅ **Its `exit 127` was self-diagnosed correctly and that is the transferable half** — `slangc: error
while loading shared libraries: … invalid ELF header` on **both** arms *including the control*, and it
refused to report two 127s as a null result. ⭐ **A control that fails identically to the probe carries
zero information** — the right call, and worth a permanent grep in any run: `grep -l "invalid
ELF\|error while loading shared libraries"` across every cell's log distinguishes *"measured a
negative"* from *"never ran"*.

✅ **Discriminator, cheap and it ends the argument in one exchange:** compare a **shape invariant**
first — line count, hash, mount mode, a control's count — before comparing prose. See
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] for instance 1, where a peer and I argued
across rounds about a file's content when one line-count comparison settled it.

⚠️ **The corollary a coworker cannot derive from its own edge:** from inside a `ro` mount you can see
*that* you cannot write, never *who* can. So an escalation target ("the write-holder is Main") has to be
told to it — it is not discoverable locally. That is why the pending spine text names Main explicitly
rather than saying "escalate upstream": see `/workspace/agent/pending-spine-edit-append-learning-readback.md`.

Related: [[feedback_six_errors_one_mechanism_a_proxy_read_where_the_artifact_was_available]] (instance
3 is a mount flag read as a proxy for the directory — #8 in that list).
