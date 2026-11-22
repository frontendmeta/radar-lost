'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { CircleAlert, CloudOff, Radar, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { NotFoundState, PageState, SignedOutState, describeError } from '@/components/screens/states';

export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const info = describeError(error);
  if (info.kind === 'auth') {
    const next = typeof window === 'undefined' ? null : window.location.pathname + window.location.search;
    return <SignedOutState next={next} />;
  }
  if (info.kind === 'not_found') return <NotFoundState body={info.body} />;

  const digest = error instanceof Error && 'digest' in error && typeof error.digest === 'string' ? error.digest : null;
  const offline = info.kind === 'offline';
  return (
    <PageState
      icon={offline ? CloudOff : CircleAlert}
      tone={offline ? 'attention' : 'error'}
      title={info.title}
      body={info.body}
      actions={
        <>
          <Button icon={RotateCcw} onClick={() => retry()}>
            Try again
          </Button>
          <Button href="/" variant="secondary" icon={Radar}>
            Back to the radar
          </Button>
        </>
      }
      footnote={digest ? `Reference ${digest}` : null}
    />
  );
}
