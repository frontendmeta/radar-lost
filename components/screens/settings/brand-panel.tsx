'use client';

import { useState } from 'react';
import { ChevronDown, Radar, Rocket } from 'lucide-react';
import type { Brand } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { ICON_STROKE, Input, YouTag } from '@/components/ui';
import { InlineError, SaveBar, TagInput, fieldError, generalError, sameList, toFormError, type FormError } from './shared';

const tooShort = (a: string) => a.replace(/\s/g, '').length < 4;

/** Pencil "50 Settings – Brand" (pC37k): identity, aliases, domains, live preview, save bar. */
export function BrandPanel({ brand, onSaved }: { brand: Brand; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(brand.name);
  const [aliases, setAliases] = useState(brand.aliases);
  const [domains, setDomains] = useState(brand.domains);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<FormError | null>(null);

  const dirty = name !== brand.name || !sameList(aliases, brand.aliases) || !sameList(domains, brand.domains);
  const shortAlias = aliases.find(tooShort);
  const shown = name.trim() || brand.name;
  const initial = shown.charAt(0).toUpperCase();

  const discard = () => {
    setName(brand.name);
    setAliases(brand.aliases);
    setDomains(brand.domains);
    setErr(null);
  };
  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await api.putBrand({ name: name.trim(), aliases, domains });
      onSaved(`${name.trim()} saved`);
    } catch (e) {
      setErr(toFormError(e));
    } finally {
      setSaving(false);
    }
  };

  const aliasError = fieldError(err, 'aliases') ?? (shortAlias ? `"${shortAlias}" is too short. Use at least 4 letters for an alias.` : undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-500 font-display text-[36px] font-bold text-on-brand"
        >
          {initial}
        </span>
        <Input
          label="Brand name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          helper="How the brand appears in answers and across this app."
          error={fieldError(err, 'name')}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TagInput
          label="Aliases"
          values={aliases}
          onChange={(v) => {
            setAliases(v);
            if (err?.field === 'aliases') setErr(null);
          }}
          invalid={tooShort}
          helper="Other names the AI might use. At least 4 letters each."
          error={aliasError}
        />
        <TagInput
          label="Domains"
          values={domains}
          onChange={(v) => {
            setDomains(v);
            if (err?.field === 'domains') setErr(null);
          }}
          lowercase
          helper={`Sites that belong to ${shown}.`}
          error={fieldError(err, 'domains')}
        />
      </div>

      <div className="flex flex-col gap-3.5 rounded-[22px] bg-brand-50 p-5">
        <span className="type-label text-brand-700">Live theme preview</span>
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex h-11 items-center gap-2 rounded-pill bg-brand-500 px-[22px] text-[15px] font-semibold text-on-brand">
            <Rocket aria-hidden size={18} strokeWidth={ICON_STROKE} /> Run AI shoppers
          </span>
          <span className="inline-flex h-11 items-center gap-1.5 rounded-pill bg-surface pr-2.5 pl-4 font-display text-[24px] leading-none font-medium text-brand-600">
            {shown}
            <ChevronDown aria-hidden size={20} strokeWidth={ICON_STROKE} className="text-ink-400" />
          </span>
          <span className="inline-flex h-11 min-w-[260px] flex-1 items-center gap-2.5 rounded-input bg-surface px-3">
            <span className="text-[15px] font-semibold text-ink-900">{shown}</span>
            <YouTag />
            <span className="relative h-3 flex-1 overflow-hidden rounded-bar bg-ink-100">
              <span className="absolute inset-y-0 left-0 w-1/3 rounded-bar bg-brand-500" />
            </span>
          </span>
          <span className="inline-flex h-12 items-center gap-2 rounded-pill bg-brand-500 px-5 text-[15px] font-semibold text-on-brand">
            <Radar aria-hidden size={20} strokeWidth={ICON_STROKE} /> Radar
          </span>
        </div>
      </div>

      <InlineError>{generalError(err, ['name', 'aliases', 'domains'])}</InlineError>
      <SaveBar dirty={dirty} saving={saving} onDiscard={discard} onSave={save} />
    </div>
  );
}
