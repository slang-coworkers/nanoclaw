/**
 * PR→Session mapping module.
 *
 * When a container agent creates a GitHub PR, it calls `report_pr_created`
 * which writes a `map_pr_session` system action to outbound. This handler
 * records the mapping in the central DB so that subsequent GitHub webhooks
 * for that PR route to the correct session (instead of creating an orphan
 * session with the PR number as thread_id).
 *
 * On non-canonical instances (PR_MAPPINGS_LOCAL=0, e.g. lego), the local
 * write is skipped and the registration is forwarded to the canonical
 * instance via INTERNAL_REGISTER_URL. See ./store.ts and ./register-client.ts.
 */
import { INSTANCE_SLUG, INTERNAL_REGISTER_URL, INTERNAL_REGISTER_SECRET, PR_MAPPINGS_LOCAL } from '../../config.js';
import { getDb } from '../../db/connection.js';
import { registerDeliveryAction } from '../../delivery.js';
import { unguarded } from '../../guard/index.js';
import { log } from '../../log.js';
import { notifyAgent } from '../approvals/index.js';
import type { Session } from '../../types.js';
import { postRegisterPr } from './register-client.js';
import { claimPrMapping } from './store.js';

registerDeliveryAction(
  'map_pr_session',
  async (content: Record<string, unknown>, session: Session) => {
    const repo = typeof content.repo === 'string' ? content.repo : null;
    const prNumber = typeof content.pr_number === 'number' ? content.pr_number : null;

    if (!repo || prNumber == null) {
      log.warn('map_pr_session: missing repo or pr_number', { content });
      return;
    }

    if (!INSTANCE_SLUG) {
      log.warn('map_pr_session: INSTANCE_SLUG unset — cannot register mapping', { repo, pr: prNumber });
      return;
    }

    const write = {
      repo,
      prNumber,
      ownerInstance: INSTANCE_SLUG,
      agentGroupId: session.agent_group_id,
      sessionId: session.id,
      threadId: session.thread_id,
    };

    if (PR_MAPPINGS_LOCAL) {
      const claim = claimPrMapping(getDb(), write);
      if (claim.outcome === 'rejected') {
        // Tell the agent, and stop. Silence here would leave it believing its
        // PR is wired for webhooks when the traffic goes somewhere else, and
        // it would keep waiting for review comments that never arrive.
        notifyAgent(
          session,
          `report_pr_created denied: ${repo}#${prNumber} is already registered to another agent group ` +
            `(${claim.prior.owner_instance}/${claim.prior.agent_group_id}). Webhooks for this PR will NOT ` +
            `route to you. If this PR really is yours, ask an admin to run ` +
            `\`ncl pr-mappings remap --repo ${repo} --pr ${prNumber} --session <your-session-id>\`.`,
        );
        return;
      }
      log.info('PR→session mapping recorded (local)', {
        repo,
        pr: prNumber,
        session: session.id,
        threadId: session.thread_id,
        owner: INSTANCE_SLUG,
        outcome: claim.outcome,
      });
    }

    if (INTERNAL_REGISTER_URL && INTERNAL_REGISTER_SECRET) {
      // Fire-and-forget per the design contract. A failure here just means
      // future webhooks for this PR will fall through to orchestrator
      // dispatch — correct, not optimal.
      void postRegisterPr(INTERNAL_REGISTER_URL, INTERNAL_REGISTER_SECRET, write).catch((err: unknown) => {
        log.warn('map_pr_session: register POST failed', {
          repo,
          pr: prNumber,
          error: String(err),
        });
      });
    }
  },
  unguarded('map_pr_session records a PR→session routing mapping — no privileged central-DB mutation'),
);
