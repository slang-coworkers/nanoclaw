### Invocation

- Workflows are prose — follow the numbered steps inline.
- `⟐ NAME GATE` blocks inside a step are mandatory at their anchor.
- `{{name}}` parameters are placeholders — ask when ambiguous.
- **Delegate to a subagent (`Agent`)** whenever output volume would pollute your context (builds, large reads, multi-step searches). One task per subagent. For recurring/cron work, use `schedule_task` instead.
