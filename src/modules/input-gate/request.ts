import { mentionsHandle } from '../../github-mention.js';
import type { GateActor, GateEvent, GateRequest } from './types.js';

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj | undefined {
  return v && typeof v === 'object' ? (v as Obj) : undefined;
}

function actorOf(user: unknown, association: unknown): GateActor | null {
  const u = obj(user);
  if (!u || typeof u.login !== 'string') return null;
  return {
    id: typeof u.id === 'number' ? u.id : null,
    login: u.login,
    type: typeof u.type === 'string' ? u.type : 'User',
    association: typeof association === 'string' ? association.toUpperCase() : null,
  };
}

/**
 * Turn one parsed GitHub delivery into what the gate decides on: who is asking
 * and whether the delivery could start work. Only an exact-word bot mention
 * starts work; issue, PR and CI events never do on their own, whoever sends them.
 */
export function gateRequestFromPayload(
  eventType: string,
  payload: Obj,
  deliveryId: string,
  botMention: string,
): GateRequest {
  const repo = typeof obj(payload.repository)?.full_name === 'string' ? String(obj(payload.repository)!.full_name) : '';
  const issue = obj(payload.issue);
  const pr = obj(payload.pull_request);
  const comment = obj(payload.comment);
  const review = obj(payload.review);
  const numberOf = (o: Obj | undefined) => (typeof o?.number === 'number' ? o.number : null);

  let event: GateEvent = 'other';
  let actor: GateActor | null = null;
  let startsWork = false;
  let number: number | null = numberOf(issue) ?? numberOf(pr);

  if (eventType === 'issues') {
    if (payload.action === 'labeled') {
      event = 'issue_labeled';
      actor = actorOf(payload.sender, null);
    } else {
      event = 'issue_opened';
      actor = actorOf(issue?.user, issue?.author_association);
    }
  } else if (eventType === 'pull_request') {
    if (payload.action === 'closed') {
      event = 'pr_closed';
    } else {
      event = 'pr_reviewable';
      // The sender acted (a push to someone else's PR included); the author's
      // association describes only the author.
      const sender = obj(payload.sender) ?? obj(pr?.user);
      const isAuthor = sender?.id !== undefined && sender.id === obj(pr?.user)?.id;
      actor = actorOf(sender, isAuthor ? pr?.author_association : null);
    }
  } else if (eventType === 'issue_comment' || eventType === 'pull_request_review_comment') {
    event = 'comment';
    actor = actorOf(comment?.user, comment?.author_association);
    startsWork = mentionsHandle(typeof comment?.body === 'string' ? comment.body : '', botMention);
  } else if (eventType === 'pull_request_review') {
    event = 'review';
    actor = actorOf(review?.user, review?.author_association);
    startsWork = mentionsHandle(typeof review?.body === 'string' ? review.body : '', botMention);
  } else if (eventType === 'pull_request_review_thread') {
    event = 'review_thread';
  } else if (eventType === 'check_suite') {
    event = 'check_suite';
    const prs = obj(payload.check_suite)?.pull_requests;
    number = Array.isArray(prs) ? numberOf(obj(prs[0])) : null;
  }

  return { deliveryId, event, repo, number, actor, startsWork };
}
