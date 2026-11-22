import type { Metadata } from 'next';
import { WelcomeScreen } from '@/components/screens/entry/welcome-screen';

export const metadata: Metadata = { title: 'Welcome · Lost Sale Radar' };

export default function WelcomePage() {
  return <WelcomeScreen />;
}
