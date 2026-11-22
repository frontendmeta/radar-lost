import { Suspense } from 'react';
import { RunsScreen } from '@/components/screens/runs/runs-screen';
import { ScreenFallback } from '@/components/screens/screen-fallback';

export default function RunsPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RunsScreen />
    </Suspense>
  );
}
