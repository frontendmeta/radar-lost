import { Suspense } from 'react';
import { RadarScreen } from '@/components/screens/radar/radar-screen';
import { ScreenFallback } from '@/components/screens/screen-fallback';

export default function Home() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <RadarScreen />
    </Suspense>
  );
}
