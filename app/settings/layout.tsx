import { Suspense, type ReactNode } from 'react';
import { ScreenFallback } from '@/components/screens/screen-fallback';
import { SettingsScreen } from '@/components/screens/settings/settings-screen';

// The settings screen lives in the layout so switching tabs (/settings/<tab>) keeps its data;
// the client screen picks the tab with useSelectedLayoutSegment(). Pages render nothing.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <SettingsScreen />
      {children}
    </Suspense>
  );
}
