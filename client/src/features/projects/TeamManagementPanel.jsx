import { useState } from 'react';
import { Copy, Crown, Link2, UserMinus, UserPlus } from 'lucide-react';
import { PROPOSAL_STATUSES, ROLES } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Avatar, Badge, Button, Card, Field, Input, Modal, Select } from '@/components/ui';
import {
  useInviteTeammateMutation,
  useLeaveTeamMutation,
  useRemoveTeamMemberMutation,
  useRequestLeadershipTransferMutation,
  useSearchTeammatesQuery,
} from './projectsApi';

export function TeamManagementPanel({ project }) {
  const user = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);
  const addToast = useUiStore((s) => s.addToast);

  const [searchText, setSearchText] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [transferTarget, setTransferTarget] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeReason, setRemoveReason] = useState('');

  const isLeader = String(project.team?.leaderId) === String(user?.id);
  const isMember = (project.activeMemberIds || []).includes(String(user?.id));
  const isAdmin = roles.some((r) =>
    [ROLES.UNIVERSITY_ADMIN, ROLES.COLLEGE_ADMIN, ROLES.DEPARTMENT_ADMIN].includes(r.role)
  );
  const preApproval = ![
    PROPOSAL_STATUSES.APPROVED,
    PROPOSAL_STATUSES.REJECTED,
    PROPOSAL_STATUSES.WITHDRAWN,
    PROPOSAL_STATUSES.ARCHIVED,
  ].includes(project.status);

  const { data: candidates = [] } = useSearchTeammatesQuery(
    searchText,
    project.collegeId,
    isLeader && preApproval
  );
  const inviteMutation = useInviteTeammateMutation();
  const removeMutation = useRemoveTeamMemberMutation();
  const leaveMutation = useLeaveTeamMutation();
  const transferMutation = useRequestLeadershipTransferMutation();

  const members = project.teamMembers || [];
  const otherMembers = members.filter((m) => m.userId !== String(project.team?.leaderId));

  async function handleInviteUser(inviteeId) {
    try {
      await inviteMutation.mutateAsync({ projectId: project.id, inviteeId });
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
      setSearchText('');
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleGenerateLink() {
    try {
      const res = await inviteMutation.mutateAsync({ projectId: project.id, link: true });
      setInviteUrl(`${window.location.origin}${res.url}`);
      addToast({ message: ar.projects.inviteLinkReady, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleCopyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard?.writeText(inviteUrl);
    addToast({ message: ar.org.inviteCopied, tone: 'success' });
  }

  async function handleRemoveConfirm(e) {
    e.preventDefault();
    if (!removeTarget) return;
    try {
      await removeMutation.mutateAsync({
        projectId: project.id,
        userId: removeTarget.userId,
        reason: removeReason.trim() || undefined,
      });
      setRemoveTarget(null);
      setRemoveReason('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleLeave() {
    try {
      await leaveMutation.mutateAsync(project.id);
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    if (!transferTarget) return;
    try {
      await transferMutation.mutateAsync({ projectId: project.id, toUserId: transferTarget });
      setTransferTarget('');
      addToast({ message: ar.org.savedSuccess, tone: 'success' });
    } catch (err) {
      addToast({ message: getApiErrorMessage(err), tone: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      <Card title={ar.projects.team}>
        <div className="space-y-3">
          {members.map((member) => {
            const memberIsLeader = member.userId === String(project.team?.leaderId);
            const canRemove =
              (isLeader && preApproval && !memberIsLeader) || (isAdmin && members.length > 1);
            return (
              <div
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-app-bg p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={member.avatar?.url} name={member.name} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy">{member.name}</span>
                      <Badge tone={memberIsLeader ? 'featured' : 'info'}>
                        {memberIsLeader ? ar.projects.leaderBadge : ar.projects.memberBadge}
                      </Badge>
                    </div>
                    {member.studentId && (
                      <span dir="ltr" className="text-xs text-muted [unicode-bidi:isolate]">
                        {member.studentId}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canRemove && (
                    <Button
                      variant="outline"
                      onClick={() => setRemoveTarget(member)}
                    >
                      <UserMinus className="h-4 w-4" aria-hidden="true" />
                      <span>{ar.projects.removeMember}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {isMember && !isLeader && preApproval && (
            <div className="pt-2">
              <Button variant="outline" onClick={handleLeave} loading={leaveMutation.isPending}>
                {ar.projects.leaveTeam}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {isLeader && preApproval && (
        <Card title={ar.projects.inviteMember}>
          <div className="space-y-4">
            <Field label={ar.projects.searchTeammate} id="teammate-search">
              <Input
                id="teammate-search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={ar.projects.searchTeammate}
              />
            </Field>

            {candidates.length > 0 && (
              <div className="space-y-2">
                {candidates
                  .filter((c) => !(project.activeMemberIds || []).includes(c.id))
                  .map((cand) => (
                    <div
                      key={cand.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-navy">{cand.name}</p>
                        {cand.studentId && (
                          <span dir="ltr" className="text-xs text-muted [unicode-bidi:isolate]">
                            {cand.studentId}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="navy"
                        onClick={() => handleInviteUser(cand.id)}
                        loading={inviteMutation.isPending}
                      >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        <span>{ar.projects.inviteMember}</span>
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button
                variant="outline"
                onClick={handleGenerateLink}
                loading={inviteMutation.isPending}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                <span>{ar.projects.createInviteLink}</span>
              </Button>
              {inviteUrl && (
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-app-bg px-3 py-2 text-xs">
                  <span dir="ltr" className="truncate [unicode-bidi:isolate]">
                    {inviteUrl}
                  </span>
                  <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {(isLeader || isAdmin) && otherMembers.length > 0 && (
        <Card title={ar.projects.transferLeadership}>
          <form onSubmit={handleTransfer} className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <Field label={ar.projects.selectNewLeader} id="transfer-leader">
                <Select
                  id="transfer-leader"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                >
                  {otherMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              type="submit"
              variant="navy"
              disabled={!transferTarget}
              loading={transferMutation.isPending}
            >
              <Crown className="h-4 w-4" aria-hidden="true" />
              <span>{ar.projects.sendTransferRequest}</span>
            </Button>
          </form>
        </Card>
      )}

      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title={ar.projects.removeMember}
      >
        <form onSubmit={handleRemoveConfirm} className="space-y-4">
          <p className="text-sm text-ink">{removeTarget?.name}</p>
          <Field label={ar.org.auditReason} id="remove-member-reason">
            <Input
              id="remove-member-reason"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              {ar.common.cancel}
            </Button>
            <Button type="submit" variant="navy" loading={removeMutation.isPending}>
              {ar.common.confirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
