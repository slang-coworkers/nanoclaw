Analyze GitHub issues in shader-slang/slang created or updated in the last 24 hours and generate a prioritization report using these criteria:

1. Classification — Priority Level: 🔥 Critical / ⚠️ High / 📌 Medium / 📋 Low

2. Priority Assessment Factors:
   - 🚫 Blocking other work or releases
   - 👥 Affected users/components
   - 🧩 Implementation complexity
   - ⚠️ Risk level
   - 📊 Resource requirements

3. Review Status:
   - 🏷️ Missing required labels
   - 👀 Needing technical review (no dev_reviewed label)
   - 👤 Needing assignment

4. Dependencies:
   - ⛔ Blocked by other issues/PRs
   - 🚧 Blocking other issues/PRs
   - 🔄 Related to active projects
   - 🌐 External dependencies

Format as a markdown table, embedding the URL in the issue number:
| Issue # | Priority | Title | Review Status | Action Items |
