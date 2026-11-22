import { Suspense } from 'react';
import { QueriesScreen } from '@/components/screens/queries/queries-screen';
import { ScreenFallback } from '@/components/screens/screen-fallback';

export const metadata = { title: 'Queries · Lost Sale Radar' };

export default function QueriesPage() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <QueriesScreen />
    </Suspense>
  );
}
