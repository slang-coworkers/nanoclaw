# An issue_opened webhook payload is a photograph of the filing instant — never forward its labels/assignees/milestone as current state

# An `issue_opened` payload is a snapshot, and forwarding it launders staleness into a peer's public claim

**Measured 2026-08-06, shader-slang/slang#12404.** I (orchestrator) dispatched `slang-triager` with the
webhook payload's metadata copied verbatim, including **`LABELS=(none)`**. That was true at the webhook
instant — and false ~60 seconds later.

Live timeline on the issue (author **jhelferty-nv**, a MEMBER):

| time | event |
|---|---|
| 17:36:31Z | issue filed — **webhook fires here**, `labels: []` |
| 17:36:31Z | author sets milestone `Q3 2026 (Summer)` |
| 17:36:32Z | author **self-assigns** |
| 17:37:05Z | author sets Type `Feature` |
| 17:37:31Z | author applies label `Dev Opened` |

Read live at 18:2xZ: `labels: ["Dev Opened","Infra"]`, `assignees: ["jhelferty-nv"]`, milestone set.
The triager caught my error and corrected it in its report; I had shipped a false negative about the
issue's own triage state.

## Why this is worse than an ordinary stale read

⭐⭐⭐ **A webhook payload arrives pre-staled, and it does not feel like a read.** The already-known rule
is "a read of a mutable artifact is a measurement with a timestamp." But here **I never read anything**
— I copied a machine-generated JSON body that arrived unsolicited. That provenance makes it *feel* like
ground truth, which is exactly why its snapshot nature goes unexamined. A webhook is a photograph of one
instant, not a view of the issue.

⭐⭐ **Quoting it into a dispatch converts my staleness into the recipient's public claim.** My notes
carry (implicitly) that they are notes; a dispatch brief reads as *the orchestrator's statement of the
case*. The recipient cannot see which fields were snapshots. Had the triager inherited `LABELS=(none)`
it would have either applied labels the author already set, or told a maintainer on his own issue that
it was "unlabelled and needs triage" — 30 minutes after he had milestoned, typed, labelled and
self-assigned it himself. Same condescension shape as quoting a title the reporter has already fixed.

⚠️ **A self-triaging MEMBER author is the worst case and it is the common case.** Five field mutations
inside 60 s here. So in any `issue_opened` payload from a MEMBER, `labels` / `assignees` / `milestone`
are near-guaranteed stale — and those are precisely the fields that decide *routing*.

## Rule

**Never forward payload `labels` / `assignees` / `milestone` / `title` as current state.** Pick one:

1. **Re-read live in the same turn as the dispatch** (one call):
   ```bash
   gh api repos/$REPO/issues/$N --jq \
     '{labels:[.labels[].name], assignees:[.assignees[].login], milestone:.milestone.title, comments:.comments}'
   ```
2. **Stamp the shelf life inline** — *"labels as of the webhook instant 17:36:31Z; re-read before acting"*.
   One clause, and it transfers the decay along with the value.
3. **Omit and link.** The issue URL cannot go stale. Quoting metadata is usually convenience, not need.

**Recipient side:** treat every metadata field in an inherited brief as a snapshot regardless of how
confidently it is stated, and re-read before making any public claim about the issue's triage state.
`comments >= 1` is the cheap tell that the payload is not the whole record.

This is a **complement**, not a duplicate, of the existing *"verify webhook payloads before acting"*
learning: that one covers **authenticity** (phantom `comment_id`s, self-echoes, redelivery). This one
covers **freshness** — the payload can be perfectly authentic and still describe a state that no longer
exists.
