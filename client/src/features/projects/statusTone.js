import { PROPOSAL_STATUSES } from '@spp/shared/constants';

export function getProposalStatusTone(status) {
  switch (status) {
    case PROPOSAL_STATUSES.APPROVED:
      return 'success';
    case PROPOSAL_STATUSES.NEEDS_CHANGES:
    case PROPOSAL_STATUSES.SUBMITTED:
    case PROPOSAL_STATUSES.UNDER_REVIEW:
      return 'warning';
    case PROPOSAL_STATUSES.REJECTED:
    case PROPOSAL_STATUSES.WITHDRAWN:
      return 'danger';
    case PROPOSAL_STATUSES.SUPERVISOR_RECOMMENDED:
      return 'featured';
    default:
      return 'info';
  }
}
