import { Suspense } from 'react';
import { ScreenFallback } from '@/components/screens/screen-fallback';
import { TraceScreen } from '@/components/screens/trace/trace-screen';

// The client screen reads the id with useParams(); this wrapper only adds the Suspense boundary.
export default function TracePage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <TraceScreen />
    </Suspense>
  );
}
