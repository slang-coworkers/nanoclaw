/**
 * "May this agent group append to the approval-decision ledger?"
 *
 * The answer comes from operator configuration (APPROVAL_LEDGER_WRITERS), not
 * from anything the container can influence about itself. Entries are matched
 * against the group id first — an exact string compare that needs no database
 * — and then, only if that misses, against the group's folder, which is the
 * handle operators actually type (`ncl groups ...`). The folder lookup is the
 * one DB touch, wrapped so a read failure denies rather than throws into the
 * guard's fail-closed catch with a less useful message.
 *
 * Empty configuration denies every caller. The denial reason names the
 * variable so the log line is the fix instruction.
 */
import { approvalLedgerWriters } from '../../config.js';
import { getAgentGroup } from '../../db/agent-groups.js';
import { log } from '../../log.js';

export interface CapabilityCheck {
  allowed: boolean;
  reason: string;
}

export async function isApprovalLedgerWriter(agentGroupId: string): Promise<CapabilityCheck> {
  const allowlist = approvalLedgerWriters();
  if (allowlist.length === 0) {
    log.error('approval-ledger: no ledger writers configured — record_decision denied for every group', {
      agentGroupId,
      fix: 'set APPROVAL_LEDGER_WRITERS to the approver agent-group folders (e.g. slang-pr-approver,slangpy-pr-approver)',
    });
    return {
      allowed: false,
      reason: 'no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)',
    };
  }

  if (allowlist.includes(agentGroupId)) {
    return { allowed: true, reason: `agent group ${agentGroupId} is a declared approval-ledger writer` };
  }

  const folder = await lookupFolder(agentGroupId);
  if (folder && allowlist.some((entry) => entry.toLowerCase() === folder.toLowerCase())) {
    return { allowed: true, reason: `agent group ${folder} is a declared approval-ledger writer` };
  }

  log.warn('approval-ledger: record_decision from a group without the ledger-writer capability', {
    agentGroupId,
    folder: folder ?? '(unknown)',
  });
  return {
    allowed: false,
    reason: `agent group ${folder ?? agentGroupId} does not hold the approval-ledger writer capability`,
  };
}

async function lookupFolder(agentGroupId: string): Promise<string | null> {
  try {
    return (await getAgentGroup(agentGroupId))?.folder ?? null;
  } catch (err) {
    log.warn('approval-ledger: agent-group lookup failed while resolving ledger-writer capability', {
      agentGroupId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
