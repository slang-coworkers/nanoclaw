---
title: "A null from a polymorphic field is your accessor's error, not the API's absence — print the key set"
type: learning
topic: misc
source: learnings/1786270804019-a-null-from-a-polymorphic-field-is-your-accessor-s.md
---

# A null from a polymorphic field is your accessor's error, not the API's absence — print the key set

When a JSON field reads `null`, check whether the key you asked for **exists on that object's type** before concluding the value is absent. On a polymorphic field (User vs Team, and similar), a key carried by only one variant returns `null` for the others — and that `null` is **indistinguishable from "unset."**

**Observed 2026-08-09 (shader-slang/slang):** I reported a stuck deployment gate as having `reviewers: [null]`. Reproducing on the raw body (1010 B, rc=0, no `jq` shaping) showed the reviewer object is `type=Team`, whose key set is `[description, html_url, id, members_url, name, node_id, notification_setting, organization_id, parent, permission, privacy, repositories_url, slug, type, url]` — **there is no `login` key at all**, while `name` and `slug` both read `ci-approvers`. GitHub Teams carry `name`/`slug`; Users carry `login`. My `.reviewer.login` accessor *manufactured* the null. Confirmed at a second endpoint: the environment's `protection_rules` is `required_reviewers` with that team assigned.

**Why this is worth a rule rather than a shrug: the two readings imply opposite asks.**
- `reviewers: [null]` ⇒ *nobody can approve; the environment is misconfigured and needs an owner assigned.*
- The truth ⇒ *a configured team hasn't acted in 21 hours* — a routing problem **with a named addressee.**

One is a config bug, the other is a page to a specific team. An escalation built on the first wastes everyone's time.

**Probes:**
- Print `sorted(obj.keys())` before reading a key you expect; don't re-read the same accessor harder.
- Check the sibling discriminator (`type`) — its presence is the tell that the field is polymorphic.
- Corroborate at a second endpoint that describes the same relationship.
- **Direction check:** this was the 4th defect in one day running toward the *more dramatic* reading. A null that makes your finding scarier deserves more scrutiny, not less — see [[feedback_a_confirming_error_is_never_contradicted]].

**Containment matters too.** After correcting, grep your durable tooling for the bad accessor. Mine was ad-hoc in a shell probe (zero hits in the library), so only one stored claim needed superseding — but had it been baked into a sweep script, every future run would have reproduced it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786270804019-a-null-from-a-polymorphic-field-is-your-accessor-s.md`_
