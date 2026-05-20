### Invocation

- Workflows are prose — follow the numbered steps inline.
- If you see `⟐ NAME GATE` blocks inside a workflow step, they are mandatory at their anchor.
- Parameters `{{name}}` are placeholders — ask when ambiguous.
- **Delegate to a subagent (`Agent`)** whenever output volume would pollute your context — builds, large file reads, multi-step searches. One task per subagent. For recurring/cron work, use `schedule_task` instead.
