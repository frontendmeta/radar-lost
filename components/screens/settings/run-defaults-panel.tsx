'use client';

import { useState } from 'react';
import type { RunDefaults } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { Input, Stepper } from '@/components/ui';
import { InlineError, PanelHeader, SaveBar, fieldError, generalError, num, str, toFormError, type FormError } from './shared';

type Draft = { attempts: number; city: string; region: string; country: string; timezone: string; lat: string; lng: string; extractorModel: string; fixesModel: string };

const toDraft = (d: RunDefaults): Draft => ({
  attempts: d.attempts, city: d.city, region: d.region, country: d.country, timezone: d.timezone,
  lat: str(d.lat), lng: str(d.lng), extractorModel: d.extractorModel ?? '', fixesModel: d.fixesModel ?? '',
});

const KNOWN = ['attempts', 'city', 'region', 'country', 'timezone', 'lat', 'lng', 'extractorModel', 'fixesModel'];

/** Run defaults (no frame yet; built from the spec with the same controls). */
export function RunDefaultsPanel({ defaults, queryCount, assistantCount, onSaved }: { defaults: RunDefaults; queryCount: number; assistantCount: number; onSaved: (msg: string) => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(defaults));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<FormError | null>(null);
  const base = toDraft(defaults);
  const dirty = (Object.keys(base) as (keyof Draft)[]).some((k) => base[k] !== d[k]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    const lat = num(d.lat);
    const lng = num(d.lng);
    if (lat === null || lng === null) {
      setErr({ field: lat === null ? 'lat' : 'lng', message: 'Enter a number.' });
      setSaving(false);
      return;
    }
    try {
      await api.patchRunDefaults({
        attempts: d.attempts, city: d.city.trim(), region: d.region.trim(), country: d.country.trim(), timezone: d.timezone.trim(),
        lat, lng, extractorModel: d.extractorModel.trim() || null, fixesModel: d.fixesModel.trim() || null,
      });
      onSaved('Run defaults saved');
    } catch (e) {
      setErr(toFormError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <PanelHeader title="Run defaults" sub="Where the AI shoppers shop from and how many times each question is asked" />
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-inner bg-surface-sunken p-5">
        <div className="flex flex-col gap-0.5">
          <span className="type-body-strong text-ink-900">Attempts per query</span>
          <span className="type-small text-ink-500">
            A full run is {queryCount} queries × {assistantCount} assistants × {d.attempts} attempts = {queryCount * assistantCount * d.attempts} answers.
          </span>
          {fieldError(err, 'attempts') && <span className="type-small text-lost-700">{fieldError(err, 'attempts')}</span>}
        </div>
        <Stepper label="Attempts per query" value={d.attempts} min={1} max={5} onValueChange={(v) => set('attempts', v)} />
      </div>
      <div className="flex flex-col gap-4">
        <span className="type-label text-ink-500">Shopper location</span>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Input label="City" value={d.city} onChange={(e) => set('city', e.target.value)} error={fieldError(err, 'city')} />
          <Input label="Region" value={d.region} onChange={(e) => set('region', e.target.value)} error={fieldError(err, 'region')} />
          <Input label="Country" value={d.country} onChange={(e) => set('country', e.target.value)} helper="Two-letter code, e.g. IN" error={fieldError(err, 'country')} />
          <Input label="Timezone" value={d.timezone} onChange={(e) => set('timezone', e.target.value)} helper="e.g. Asia/Kolkata" error={fieldError(err, 'timezone')} />
          <Input label="Latitude" inputMode="decimal" value={d.lat} onChange={(e) => set('lat', e.target.value)} error={fieldError(err, 'lat')} />
          <Input label="Longitude" inputMode="decimal" value={d.lng} onChange={(e) => set('lng', e.target.value)} error={fieldError(err, 'lng')} />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <span className="type-label text-ink-500">Models behind the analysis</span>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Input label="Extractor model" value={d.extractorModel} placeholder="Uses the default model" onChange={(e) => set('extractorModel', e.target.value)} helper="Reads each answer into a decision." error={fieldError(err, 'extractorModel')} />
          <Input label="Fixes model" value={d.fixesModel} placeholder="Uses the extractor's model" onChange={(e) => set('fixesModel', e.target.value)} helper="Writes the 3 fixes when a run finishes." error={fieldError(err, 'fixesModel')} />
        </div>
      </div>
      <InlineError>{generalError(err, KNOWN)}</InlineError>
      <SaveBar dirty={dirty} saving={saving} onDiscard={() => { setD(base); setErr(null); }} onSave={save} />
    </div>
  );
}
