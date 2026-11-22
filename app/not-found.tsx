import type { Metadata } from 'next';
import { NotFoundState } from '@/components/screens/states';

export const metadata: Metadata = { title: 'Not found · Lost Sale Radar' };

export default function NotFound() {
  return <NotFoundState />;
}
