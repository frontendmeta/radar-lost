'use client';

import { useState } from 'react';
import { CircleCheck, ExternalLink, KeyRound, Lock, Replace, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import type { Assistant, AssistantInfo, ProviderKeyInfo } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { AssistantBadge, Banner, Button, ICON_STROKE, Input, Toggle, cn } from '@/components/ui';
import { relativeTime } from '../format';
import { ConfirmButton, InlineError, PanelHeader, fieldError, toFormError, type FormError, type ToastTone } from './shared';

const ORDER: Assistant[] = ['openai', 'anthropic', 'gemini'];
const PROVIDER: Record<Assistant, string> = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google' };
const KEY_HINT: Record<Assistant, string> = { openai: 'sk-…', anthropic: 'sk-ant-…', gemini: 'AIza…' };
const KEY_URL: Record<Assistant, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  gemini: 'https://aistudio.google.com/apikey',
};

type Notify = (title: string, tone?: ToastTone) => void;

export function KeyChip({ info }: { info: Pick<ProviderKeyInfo, 'keyPresent' | 'source'> | undefined }) {
  if (!info?.keyPresent) {
    return (
      <span className="inline-flex h-6 w-fit items-center gap-1.5 rounded-pill bg-lost-50 pr-2.5 pl-2 text-[12px] font-semibold text-lost-700">
        <KeyRound aria-hidden size={14} strokeWidth={ICON_STROKE} className="text-lost-500" /> Key missing
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-fit items-center gap-1.5 rounded-pill bg-picked-50 pr-2.5 pl-2 text-[12px] font-semibold text-picked-700">
      <KeyRound aria-hidden size={14} strokeWidth={ICON_STROKE} className="text-picked-500" />
      {info.source === 'env' ? 'Key from server env' : 'Key connected'}
    </span>
  );
}

function KeyRow({
  info, assistant, onChanged, onAssistantChanged,
}: { info: ProviderKeyInfo; assistant?: AssistantInfo; onChanged: Notify; onAssistantChanged: Notify }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState<'save' | 'toggle' | null>(null);
  const [err, setErr] = useState<FormError | null>(null);
  const [saved, setSaved] = useState<{ verified: boolean } | null>(null);
  const id = info.assistant;
  const label = info.label;
  const present = info.keyPresent;
  const showForm = editing || !present;

  const save = async () => {
    const key = value.trim();
    if (!key) return;
    setBusy('save');
    setErr(null);
    try {
      const res = await api.saveKey(id, key);
      setValue('');
      setEditing(false);
      setSaved({ verified: res.verified });
      onChanged(res.verified ? `${label} key verified with ${PROVIDER[id]}` : `${label} key saved — couldn't verify right now`, res.verified ? 'success' : 'info');
    } catch (e) {
      setErr(toFormError(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setErr(null);
    try {
      await api.deleteKey(id);
      setSaved(null);
      onChanged(`${label} key removed`, 'info');
    } catch (e) {
      setErr(toFormError(e));
    }
  };

  const toggle = async (on: boolean) => {
    setBusy('toggle');
    setErr(null);
    try {
      await api.patchAssistant(id, { enabled: on });
      onAssistantChanged(`${label} turned ${on ? 'on' : 'off'} for runs`);
    } catch (e) {
      setErr(toFormError(e));
    } finally {
      setBusy(null);
    }
  };

  const enabled = assistant?.enabled ?? false;
  const toggleLocked = !present && !enabled;

  return (
    <li className="flex flex-col gap-4 rounded-[22px] border border-ink-200 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-4">
        <AssistantBadge assistant={id} disabled={!present} className="size-12 text-[15px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="type-h3 text-ink-900">{label}</span>
          <KeyChip info={info} />
        </div>
        {assistant && (
          <div className="flex items-center gap-2.5">
            <span className="type-small text-ink-500">{enabled ? 'On for runs' : 'Off for runs'}</span>
            {toggleLocked && <Lock aria-hidden size={16} strokeWidth={ICON_STROKE} className="text-ink-500" />}
            <Toggle
              label={`Use ${label} on runs`}
              checked={enabled}
              disabled={busy === 'toggle' || toggleLocked}
              onCheckedChange={toggle}
            />
          </div>
        )}
      </div>

      {present && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-input bg-surface-sunken py-2 pr-2 pl-4">
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 type-small text-ink-500">
            {info.source === 'env' ? (
              <span>Set in the server env. A key saved here takes over.</span>
            ) : (
              <>
                <span className="font-mono text-[13px] font-semibold tracking-wide text-ink-900">•••• {info.last4 ?? '····'}</span>
                {info.updatedByEmail && <span>· saved by {info.updatedByEmail}</span>}
                {info.updatedAt && <span>· {relativeTime(info.updatedAt)}</span>}
              </>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Replace}
              onClick={() => {
                setEditing(true);
                setErr(null);
                setSaved(null);
              }}
            >
              Replace
            </Button>
            {info.source === 'ui' && <ConfirmButton label="Remove" icon={Trash2} onConfirm={remove} />}
          </span>
        </div>
      )}

      {saved && !editing && (
        <p className={cn('flex items-center gap-1.5 type-small', saved.verified ? 'text-picked-700' : 'text-marigold-700')} role="status">
          {saved.verified ? (
            <>
              <CircleCheck aria-hidden size={16} strokeWidth={ICON_STROKE} /> Verified with {PROVIDER[id]}
            </>
          ) : (
            <>
              <TriangleAlert aria-hidden size={16} strokeWidth={ICON_STROKE} /> Saved — couldn&apos;t verify right now
            </>
          )}
        </p>
      )}

      {showForm && (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            label={`${label} API key`}
            type="password"
            name={`lsr-${id}-api-key`}
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            data-1p-ignore
            data-lpignore="true"
            value={value}
            placeholder={`Paste your ${PROVIDER[id]} key (${KEY_HINT[id]})`}
            onChange={(e) => {
              setValue(e.target.value);
              if (err) setErr(null);
            }}
            error={fieldError(err, 'apiKey')}
            helper={
              <>
                We check it with {PROVIDER[id]}, then store it encrypted. It&apos;s never shown again.{' '}
                <a href={KEY_URL[id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-brand-600 hover:underline">
                  Get a key <ExternalLink aria-hidden size={12} strokeWidth={ICON_STROKE} />
                </a>
              </>
            }
          />
          <div className="flex shrink-0 gap-2 sm:mt-7">
            <Button type="submit" icon={ShieldCheck} loading={busy === 'save'} disabled={!value.trim()}>
              {busy === 'save' ? 'Checking…' : 'Save key'}
            </Button>
            {editing && (
              <Button
                variant="secondary"
                disabled={busy === 'save'}
                onClick={() => {
                  setEditing(false);
                  setValue('');
                  setErr(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      {err && !fieldError(err, 'apiKey') && <InlineError>{err.message}</InlineError>}
    </li>
  );
}

/** API keys: one row per assistant, keys pasted here are verified then stored encrypted (never returned). */
export function KeysPanel({
  keys, keysError, onRetryKeys, assistants, onChanged, onAssistantChanged,
}: {
  keys?: ProviderKeyInfo[];
  keysError?: Error;
  onRetryKeys: () => void;
  assistants: AssistantInfo[];
  onChanged: Notify;
  onAssistantChanged: Notify;
}) {
  const rows = (keys ?? []).slice().sort((a, b) => ORDER.indexOf(a.assistant) - ORDER.indexOf(b.assistant));
  const noKeys = keys ? keys.every((k) => !k.keyPresent) : false;

  return (
    <div className="flex flex-col gap-4">
      <PanelHeader title="API keys" sub="Each AI shopper needs its provider's key. Paste it once; we only ever show the last 4 characters." />
      {noKeys && (
        <Banner tone="attention" icon={KeyRound} spin={false}>
          Add your API keys to start a run
        </Banner>
      )}
      {keysError && !keys && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-inner bg-lost-50 px-4 py-3 type-small text-lost-700">
          <span>Couldn&apos;t load API keys: {keysError.message}</span>
          <button type="button" onClick={onRetryKeys} className="cursor-pointer font-semibold underline">Retry</button>
        </div>
      )}
      {!keys && !keysError ? (
        <ul className="flex flex-col gap-4" aria-busy>
          {ORDER.map((a) => (
            <li key={a} className="h-[124px] animate-pulse rounded-[22px] bg-surface-sunken" />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((k) => (
            <KeyRow key={k.assistant} info={k} assistant={assistants.find((a) => a.id === k.assistant)} onChanged={onChanged} onAssistantChanged={onAssistantChanged} />
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 px-2 pt-1 type-small text-ink-500">
        <Lock aria-hidden size={14} strokeWidth={ICON_STROKE} className="mt-[3px] shrink-0" />
        Keys are encrypted at rest and never sent back to the browser. A key saved here wins over one set in the server env.
      </p>
    </div>
  );
}
