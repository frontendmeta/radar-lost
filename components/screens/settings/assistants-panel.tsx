'use client';

import Link from 'next/link';
import { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import type { AssistantInfo, ProviderKeyInfo } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { AssistantBadge, Button, ICON_STROKE, Input, Toggle, Tooltip, cn } from '@/components/ui';
import { KeyChip } from './keys-panel';
import { InlineError, PanelHeader, fieldError, toFormError, type FormError, type ToastTone } from './shared';

type Notify = (title: string, tone?: ToastTone) => void;

function AssistantRow({ a, keyInfo, onChanged }: { a: AssistantInfo; keyInfo?: ProviderKeyInfo; onChanged: Notify }) {
  const [model, setModel] = useState(a.model ?? '');
  const [busy, setBusy] = useState<'toggle' | 'model' | null>(null);
  const [err, setErr] = useState<FormError | null>(null);
  const keyPresent = keyInfo?.keyPresent ?? a.keyPresent;
  const modelDirty = (a.model ?? '') !== model.trim();
  const locked = !a.enabled && !keyPresent;

  const patch = async (which: 'toggle' | 'model', body: { enabled?: boolean; model?: string | null }, msg: string) => {
    setBusy(which);
    setErr(null);
    try {
      await api.patchAssistant(a.id, body);
      onChanged(msg);
    } catch (e) {
      setErr(toFormError(e));
    } finally {
      setBusy(null);
    }
  };
  const saveModel = () => patch('model', { model: model.trim() || null }, `${a.label} model saved`);

  const toggle = (
    <Toggle
      label={`${a.label} goes out on runs`}
      checked={a.enabled}
      disabled={busy === 'toggle' || locked}
      onCheckedChange={(v) => patch('toggle', { enabled: v }, `${a.label} turned ${v ? 'on' : 'off'}`)}
    />
  );

  return (
    <li className={cn('flex flex-col gap-3 rounded-[22px] border border-ink-200 bg-surface p-5', !a.enabled && 'bg-surface-sunken/40')}>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex w-[220px] shrink-0 items-center gap-5">
          <AssistantBadge assistant={a.id} disabled={!a.enabled} className="size-12 text-[15px]" />
          <div className="flex flex-col gap-1.5">
            <span className="type-h3 text-ink-900">{a.label}</span>
            <KeyChip info={keyInfo ?? { keyPresent: a.keyPresent, source: null }} />
          </div>
        </div>
        <div className="flex min-w-[240px] flex-1 items-start gap-2">
          <Input
            label="Model"
            value={model}
            placeholder="Uses the default model"
            helper={`Now using ${a.effectiveModel || '—'}`}
            onChange={(e) => setModel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && modelDirty && saveModel()}
            error={fieldError(err, 'model')}
          />
          {modelDirty && (
            <Button className="mt-7" loading={busy === 'model'} onClick={saveModel}>
              Save
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              {toggle}
              <Tooltip content={`Add the ${a.label} API key to turn this on`}>
                <Link href="/settings/keys" aria-label={`Add the ${a.label} API key`} className="flex size-8 items-center justify-center rounded-pill text-ink-500 hover:bg-ink-100">
                  <Lock aria-hidden size={16} strokeWidth={ICON_STROKE} />
                </Link>
              </Tooltip>
            </>
          ) : (
            toggle
          )}
        </div>
      </div>
      {locked && (
        <p className="flex flex-wrap items-center gap-2 type-small text-ink-500">
          No key yet, so {a.label} can&apos;t go out on runs.
          <Button href="/settings/keys" variant="ghost" size="sm" icon={KeyRound}>Add key</Button>
        </p>
      )}
      {err && !fieldError(err, 'model') && <InlineError>{err.message}</InlineError>}
    </li>
  );
}

/** Pencil "53 Settings – Assistants" (n4AOWA). Keys live in their own tab. */
export function AssistantsPanel({
  assistants, keys, keysError, onChanged,
}: { assistants: AssistantInfo[]; keys?: ProviderKeyInfo[]; keysError?: Error; onChanged: Notify }) {
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader title="Assistants" sub="Which AI shoppers go out on each run" />
      {keysError && <InlineError>Couldn&apos;t load API key status: {keysError.message}</InlineError>}
      <ul className="flex flex-col gap-4">
        {assistants.map((a) => (
          <AssistantRow key={`${a.id}:${a.model ?? ''}`} a={a} keyInfo={keys?.find((k) => k.assistant === a.id)} onChanged={onChanged} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[22px] border border-ink-200 bg-surface-sunken px-5 py-4">
        <span className="type-label text-ink-500">When a key is missing</span>
        <KeyChip info={{ keyPresent: false, source: null }} />
        <span className="flex items-center gap-2">
          <Toggle label="Locked example" checked={false} disabled />
          <Lock aria-hidden size={16} strokeWidth={ICON_STROKE} className="text-ink-500" />
        </span>
        <span className="type-small text-ink-500">
          Add the key in{' '}
          <Link href="/settings/keys" className="font-semibold text-brand-600 hover:underline">API keys</Link>{' '}
          to turn it on.
        </span>
      </div>
    </div>
  );
}
