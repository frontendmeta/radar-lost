import { redirect } from 'next/navigation';

// /settings/keys: API keys are no longer managed in the app; send old links to Brand.
export default function SettingsKeysPage() {
  redirect('/settings/brand');
}
