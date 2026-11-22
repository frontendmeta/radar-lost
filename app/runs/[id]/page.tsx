import { Suspense } from 'react';
import { RunProgressScreen } from '@/components/screens/runs/run-progress-screen';
import { ScreenFallback } from '@/components/screens/screen-fallback';

// The client screen reads the id with useParams(); this wrapper only adds the Suspense boundary.
export default function RunPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RunProgressScreen />
    </Suspense>
  );
}
