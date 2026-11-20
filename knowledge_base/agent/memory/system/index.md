# Memory System

- [Definition](definition.md) - how this memory works and can evolve
- [Standing hazards hub](hazards.md) - one-line pointers to every operational hazard subtopic page
- [Messaging and routing hazards](hazards-messaging-routing.md) - message-block delivery, pinned sends, in_reply_to precedence, Maintainer reply edge
- [ncl CLI tooling hazards](hazards-ncl-tooling.md) - timed-out mutating verbs, database-locked sends, retired read wedge
- [Memory store hazards](hazards-memory-store.md) - retired native store, no-counts rule, disjoint legoop-archive
- [Sibling Main session hazards](hazards-sibling-sessions.md) - duplicate-owner races, owed-report dedupe, grep race, self-session check
- [GitHub auth and quota hazards](hazards-github-auth.md) - quota-window app_not_connected, fleet-wide vault outage
- [Discord posting boundaries](hazards-discord-boundaries.md) - maintainer read-only role, bot send allowlist
- [Edit-tool append technique](hazards-edit-append.md) - anchor appends on the final line, never a bullet's opening line
- [Skills registry is read-only from containers](skills-registry-readonly.md) - `/app/skills` (= `.agents/skills`) is a ro host-managed registry; skill fixes = verified patch → operator, and learnings do NOT change skill behavior (R10 defect recurred 3 weeks despite 2 learnings)
