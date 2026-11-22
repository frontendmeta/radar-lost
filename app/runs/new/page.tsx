import { Suspense } from 'react';
import { NewRunScreen } from '@/components/screens/runs/new-run-screen';
import { ScreenFallback } from '@/components/screens/screen-fallback';

export default function NewRunPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <NewRunScreen />
    </Suspense>
  );
}
