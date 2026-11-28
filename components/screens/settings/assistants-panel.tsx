'use client';

import { useState } from 'react';
import type { AssistantInfo } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { AssistantBadge, Button, Input, Toggle, cn } from '@/components/ui';
import { InlineError, PanelHeader, fieldError, toFormError, type FormError, type ToastTone } from './shared';

type Notify = (title: string, tone?: ToastTone) => void;

function AssistantRow({ a, onChanged }: { a: AssistantInfo; onChanged: Notify }) {
  const [model, setModel] = useState(a.model ?? '');
  const [busy, setBusy] = useState<'toggle' | 'model' | null>(null);
  const [err, setErr] = useState<FormError | null>(null);
  const keyPresent = a.keyPresent;
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
            <span className={cn('type-small', keyPresent ? 'text-picked-700' : 'text-ink-500')}>
              {keyPresent ? 'Connected' : 'Not connected'}
            </span>
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
        <div className="flex items-center gap-2">{toggle}</div>
      </div>
      {locked && <p className="type-small text-ink-500">{a.label} isn&apos;t connected right now, so it can&apos;t go out on runs.</p>}
      {err && !fieldError(err, 'model') && <InlineError>{err.message}</InlineError>}
    </li>
  );
}

/** Pencil "53 Settings – Assistants" (n4AOWA). */
export function AssistantsPanel({ assistants, onChanged }: { assistants: AssistantInfo[]; onChanged: Notify }) {
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader title="Assistants" sub="Which AI shoppers go out on each run" />
      <ul className="flex flex-col gap-4">
        {assistants.map((a) => (
          <AssistantRow key={`${a.id}:${a.model ?? ''}`} a={a} onChanged={onChanged} />
        ))}
      </ul>
    </div>
  );
}
