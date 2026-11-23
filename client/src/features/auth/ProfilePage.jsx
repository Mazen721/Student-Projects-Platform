import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { PRIVACY_VISIBILITY } from '@spp/shared/constants';
import ar from '@/locales/ar';
import { getApiErrorMessage } from '@/lib/errors';
import { useUiStore } from '@/stores/uiStore';
import {
  Avatar,
  Button,
  Card,
  CardSkeleton,
  Field,
  FileUploader,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { useMyProfileQuery, useUpdateProfileMutation } from './authApi';

export default function ProfilePage() {
  const { data: profile, isLoading } = useMyProfileQuery();
  const updateMutation = useUpdateProfileMutation();
  const addToast = useUiStore((s) => s.addToast);

  const [bio, setBio] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [phone, setPhone] = useState('');
  const [socialText, setSocialText] = useState('');
  const [avatarUpload, setAvatarUpload] = useState(null);
  const [privacy, setPrivacy] = useState({
    email: PRIVACY_VISIBILITY.PRIVATE,
    phone: PRIVACY_VISIBILITY.PRIVATE,
    socialLinks: PRIVACY_VISIBILITY.PRIVATE,
  });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!profile) return;
    setBio(profile.profile?.bio || '');
    setSkillsText((profile.profile?.skills || []).join('، '));
    setPhone(profile.profile?.phone || '');
    setSocialText((profile.profile?.socialLinks || []).join('\n'));
    setPrivacy({
      email: profile.privacy?.email || PRIVACY_VISIBILITY.PRIVATE,
      phone: profile.privacy?.phone || PRIVACY_VISIBILITY.PRIVATE,
      socialLinks: profile.privacy?.socialLinks || PRIVACY_VISIBILITY.PRIVATE,
    });
  }, [profile]);

  if (isLoading || !profile) {
    return <CardSkeleton />;
  }

  const privacyOptions = [
    { value: PRIVACY_VISIBILITY.PRIVATE, label: ar.auth.privacyPrivate },
    { value: PRIVACY_VISIBILITY.PUBLIC, label: ar.auth.privacyPublic },
  ];

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg('');
    const skills = skillsText
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const socialLinks = socialText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await updateMutation.mutateAsync({
        bio,
        skills,
        phone,
        socialLinks,
        privacy,
        ...(avatarUpload ? { avatar: avatarUpload } : {}),
      });
      setAvatarUpload(null);
      addToast({ message: ar.auth.profileSaved, tone: 'success' });
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <Helmet title={`${ar.auth.profileTitle} — ${ar.common.platformName}`} />

      <header className="rounded-2xl bg-navy p-6 text-white">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={profile.profile?.avatar?.url} name={profile.name} size="lg" />
          <div>
            <h1 className="text-xl font-extrabold">{profile.name}</h1>
            <p className="mt-1 text-sm text-gold-light">
              <span dir="ltr" className="inline-block [unicode-bidi:isolate]">
                {profile.email}
              </span>
            </p>
          </div>
        </div>
      </header>

      <Card title={ar.auth.profileTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div role="alert" className="rounded-xl bg-[#fee2e2] px-4 py-3 text-sm font-bold text-[#b91c1c]">
              {errorMsg}
            </div>
          )}

          <Field label={ar.auth.avatar} id="profile-avatar">
            <FileUploader
              purpose="avatar"
              onUploaded={(res) => setAvatarUpload(res)}
              onError={(msg) => setErrorMsg(msg)}
            />
          </Field>

          <Field label={ar.auth.bio} id="profile-bio">
            <Textarea
              id="profile-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </Field>

          <Field label={ar.auth.skills} id="profile-skills">
            <Input
              id="profile-skills"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
            />
          </Field>

          <Field label={ar.auth.phone} id="profile-phone">
            <Input
              id="profile-phone"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <Field label={ar.auth.socialLinks} id="profile-social">
            <Textarea
              id="profile-social"
              dir="ltr"
              rows={3}
              value={socialText}
              onChange={(e) => setSocialText(e.target.value)}
            />
          </Field>

          <div className="rounded-xl border border-line bg-app-bg p-4">
            <h2 className="mb-3 text-sm font-extrabold text-navy">{ar.auth.privacySettings}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label={ar.auth.email} id="priv-email">
                <Select
                  id="priv-email"
                  placeholder={false}
                  options={privacyOptions}
                  value={privacy.email}
                  onChange={(e) => setPrivacy((p) => ({ ...p, email: e.target.value }))}
                />
              </Field>
              <Field label={ar.auth.phone} id="priv-phone">
                <Select
                  id="priv-phone"
                  placeholder={false}
                  options={privacyOptions}
                  value={privacy.phone}
                  onChange={(e) => setPrivacy((p) => ({ ...p, phone: e.target.value }))}
                />
              </Field>
              <Field label={ar.auth.socialLinks} id="priv-social">
                <Select
                  id="priv-social"
                  placeholder={false}
                  options={privacyOptions}
                  value={privacy.socialLinks}
                  onChange={(e) => setPrivacy((p) => ({ ...p, socialLinks: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="gold" loading={updateMutation.isPending}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
