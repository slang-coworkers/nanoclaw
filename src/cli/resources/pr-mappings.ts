/**
 * PR→session mappings — read, plus the one authorized way to reassign one.
 *
 * `pr_session_mappings` decides where a PR's GitHub webhooks are delivered.
 * Agents claim rows through `report_pr_created`, which is first-claim-wins
 * (`src/modules/pr-mapping/store.ts`): a group that already holds a PR may
 * refresh it, anybody else is refused. That leaves a real operation with
 * nowhere to go — a PR legitimately changing hands (fork pickup, reroute, a
 * coworker handing off) — which is what `remap` is for.
 *
 * It lives here, on the guarded CLI, rather than as a `force` field on the MCP
 * tool. A correction has to be a decision somebody made and can be seen to
 * have made; a flag on an agent-composed message is just the hijack with an
 * extra step.
 */
import { registerResource } from '../crud.js';
import { getAgentGroup } from '../../db/agent-groups.js';
import { getSession } from '../../db/sessions.js';
import { getDb } from '../../db/connection.js';
import { INSTANCE_SLUG } from '../../config.js';
import { overridePrMapping } from '../../modules/pr-mapping/store.js';

interface PrMappingRow {
  repo: string;
  pr_number: number;
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
  owner_instance: string;
  created_at: string;
}

function readMapping(repo: string, prNumber: number): PrMappingRow | undefined {
  return getDb().prepare('SELECT * FROM pr_session_mappings WHERE repo = ? AND pr_number = ?').get(repo, prNumber) as
    | PrMappingRow
    | undefined;
}

registerResource({
  name: 'pr-mapping',
  plural: 'pr-mappings',
  table: 'pr_session_mappings',
  description:
    'PR→session routing table. One row per (repo, pr_number) saying which session on which instance owns a PR, ' +
    'so its GitHub webhooks land in the right inbox. Agents claim rows via `report_pr_created` on a ' +
    'first-claim-wins basis; use `remap` to reassign one deliberately.',
  idColumn: 'repo',
  scopeField: 'agent_group_id',
  columns: [
    { name: 'repo', type: 'string', description: 'owner/name of the GitHub repository.' },
    { name: 'pr_number', type: 'number', description: 'Pull request number within that repository.' },
    { name: 'agent_group_id', type: 'string', description: 'Agent group that owns this PR.' },
    { name: 'session_id', type: 'string', description: "Session that receives this PR's webhooks." },
    { name: 'thread_id', type: 'string', description: 'Thread within that session, if any.' },
    { name: 'owner_instance', type: 'string', description: 'NanoClaw install that owns the PR (prod, lego).' },
    { name: 'created_at', type: 'string', description: 'When the current mapping was written.' },
  ],
  operations: { list: 'open' },
  customOperations: {
    remap: {
      access: 'approval',
      // An agent pointing a PR mapping at its OWN group is the escalation this
      // whole change exists to stop — refuse it outright rather than minting an
      // approval card a human might wave through. Reassigning a PR to SOMEONE
      // ELSE stays available to the orchestrator, behind approval.
      denySelfTarget: true,
      description:
        'Reassign a PR→session mapping. --repo <owner/name> --pr <number> --session <session-id> ' +
        '[--reason <text>]. The agent group and instance are taken from the session, never from a flag. ' +
        'Use when a PR legitimately changes hands; routine registration happens via report_pr_created.',
      handler: async (args, ctx) => {
        const repo = String(args.repo ?? '').trim();
        const prNumber = Number(args.pr);
        const sessionId = String(args.session ?? '').trim();
        const reason = String(args.reason ?? '').trim() || 'no reason given';

        // Same refusal the delivery action makes: with no instance identity
        // there is no meaningful `owner_instance` to write, and a row claiming
        // an instance that does not exist routes webhooks nowhere.
        if (!INSTANCE_SLUG) {
          throw new Error('INSTANCE_SLUG is not set on this install — PR mappings cannot be written.');
        }
        if (!repo || !repo.includes('/')) throw new Error('--repo is required, as owner/name');
        if (!Number.isFinite(prNumber) || prNumber <= 0) throw new Error('--pr is required and must be positive');
        if (!sessionId) throw new Error('--session is required');

        // Derive the group from the session rather than accepting it. A caller
        // that could name both could point a PR at a session in one group while
        // labelling it another, and the routing layer reads the group.
        const target = getSession(sessionId);
        if (!target) throw new Error(`No session ${sessionId}`);
        const group = getAgentGroup(target.agent_group_id);
        if (!group) throw new Error(`Session ${sessionId} belongs to unknown agent group ${target.agent_group_id}`);

        if (ctx?.caller === 'agent' && ctx.agentGroupId === target.agent_group_id) {
          throw new Error(
            'An agent cannot remap a PR to its own agent group. Ask the admin/Main group to make this change.',
          );
        }

        const before = readMapping(repo, prNumber);
        const { prior } = overridePrMapping(
          getDb(),
          {
            repo,
            prNumber,
            ownerInstance: INSTANCE_SLUG,
            agentGroupId: target.agent_group_id,
            sessionId: target.id,
            threadId: target.thread_id,
          },
          `${reason} (via ncl pr-mappings remap, caller=${ctx?.caller ?? 'host'})`,
        );

        return {
          repo,
          pr_number: prNumber,
          previous: prior
            ? {
                owner_instance: prior.owner_instance,
                agent_group_id: prior.agent_group_id,
                session_id: prior.session_id,
              }
            : null,
          current: {
            owner_instance: INSTANCE_SLUG,
            agent_group_id: target.agent_group_id,
            agent_group: group.name,
            session_id: target.id,
          },
          reason,
          note: before
            ? `Reassigned ${repo}#${prNumber} from ${prior?.agent_group_id ?? 'unknown'} to ${group.name}. ` +
              'Future webhooks for this PR route to the new session.'
            : `Created a mapping for ${repo}#${prNumber} → ${group.name}. No previous owner.`,
        };
      },
    },
  },
});
