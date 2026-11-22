'use client';

import { useState } from 'react';
import { Globe, Pencil, Plus, ShoppingCart } from 'lucide-react';
import type { Brand, Marketplace } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { BrandLogo, Button, EmptyState, ICON_STROKE, Input, brandLogoSrc, competitorColor } from '@/components/ui';
import { ConfirmButton, FORM_WELL, InlineError, PanelHeader, TagInput, fieldError, generalError, toFormError, type FormError } from './shared';

type Kind = 'competitor' | 'marketplace';
type Item = { id: string; name: string; aliases?: string[]; domains: string[] };

const tooShort = (a: string) => a.replace(/\s/g, '').length < 4;

function EntityForm({ kind, item, onCancel, onDone }: { kind: Kind; item?: Item; onCancel: () => void; onDone: (msg: string) => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [aliases, setAliases] = useState<string[]>(item?.aliases ?? []);
  const [domains, setDomains] = useState<string[]>(item?.domains ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<FormError | null>(null);
  const isComp = kind === 'competitor';

  const save = async () => {
    setSaving(true);
    setErr(null);
    const n = name.trim();
    try {
      if (isComp) {
        // A new competitor's name is its first alias unless the user typed others.
        const body = { name: n, aliases: aliases.length ? aliases : n ? [n] : [], domains };
        if (item) await api.updateCompetitor(item.id, body);
        else await api.createCompetitor(body);
      } else {
        const body = { name: n, domains };
        if (item) await api.updateMarketplace(item.id, body);
        else await api.createMarketplace(body);
      }
      onDone(item ? `${n} saved` : `${n} added`);
    } catch (e) {
      setErr(toFormError(e));
    } finally {
      setSaving(false);
    }
  };

  const short = aliases.find(tooShort);

  return (
    <form
      className={FORM_WELL}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save();
      }}
    >
      <Input label="Name" value={name} autoFocus onChange={(e) => setName(e.target.value)} error={fieldError(err, 'name')} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {isComp && (
          <TagInput
            label="Aliases"
            values={aliases}
            onChange={setAliases}
            invalid={tooShort}
            helper={aliases.length ? 'Names the AI might use. At least 4 letters each.' : `Leave empty to use "${name.trim() || 'the name'}".`}
            error={fieldError(err, 'aliases') ?? (short ? `"${short}" is too short. Use at least 4 letters for an alias.` : undefined)}
          />
        )}
        <TagInput
          label="Domains"
          values={domains}
          onChange={setDomains}
          lowercase
          helper={isComp ? 'Leave empty for marketplace-only brands.' : 'e.g. myntra.com'}
          error={fieldError(err, 'domains')}
        />
      </div>
      <InlineError>{generalError(err, ['name', 'aliases', 'domains'])}</InlineError>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving} disabled={!name.trim()}>{item ? 'Save' : isComp ? 'Add competitor' : 'Add marketplace'}</Button>
      </div>
    </form>
  );
}

function AliasChip({ children }: { children: string }) {
  return <span className="inline-flex h-[26px] items-center rounded-pill bg-ink-100 px-2.5 text-[12px] font-semibold text-ink-700">{children}</span>;
}

function DomainChip({ children }: { children: string }) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-pill border border-ink-200 bg-surface px-2.5 text-[12px] font-semibold text-ink-700">
      <Globe aria-hidden size={14} strokeWidth={ICON_STROKE} /> {children}
    </span>
  );
}

/** Pencil "51 Settings – Competitors" (UrbFe); Marketplaces reuse the same layout. */
export function BrandsPanel({ kind, items, onChanged }: { kind: Kind; items: (Brand | Marketplace)[]; onChanged: (msg: string) => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; err: FormError } | null>(null);
  const isComp = kind === 'competitor';
  const done = (m: string) => {
    setEditing(null);
    onChanged(m);
  };

  const archive = async (it: Item) => {
    setRowErr(null);
    try {
      if (isComp) await api.deleteCompetitor(it.id);
      else await api.deleteMarketplace(it.id);
      onChanged(`${it.name} archived`);
    } catch (e) {
      setRowErr({ id: it.id, err: toFormError(e) });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <PanelHeader
        title={isComp ? 'Competitors' : 'Marketplaces'}
        sub={isComp ? 'Brands we look for in every answer. Colours follow who wins most.' : 'Shops where the AI might buy. Used to tell a marketplace page from a brand site.'}
        action={editing !== 'new' && <Button icon={Plus} onClick={() => setEditing('new')}>{isComp ? 'Add competitor' : 'Add marketplace'}</Button>}
      />
      {editing === 'new' && <EntityForm kind={kind} onCancel={() => setEditing(null)} onDone={done} />}
      {items.length === 0 && editing !== 'new' ? (
        <EmptyState
          title={isComp ? 'No competitors yet' : 'No marketplaces yet'}
          body={isComp ? 'Add the brands you lose sales to. We look for them in every answer.' : 'Add shops like Myntra or Amazon so we can tell them from brand sites.'}
          action={<Button icon={Plus} onClick={() => setEditing('new')}>{isComp ? 'Add competitor' : 'Add marketplace'}</Button>}
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((raw, i) => {
            const it: Item = raw;
            if (editing === it.id) {
              return (
                <li key={it.id} className="py-3">
                  <EntityForm kind={kind} item={it} onCancel={() => setEditing(null)} onDone={done} />
                </li>
              );
            }
            const aliases = it.aliases ?? [];
            return (
              <li key={it.id} className="flex flex-col border-b border-ink-200 last:border-b-0">
                <div className="flex min-h-[76px] flex-wrap items-center gap-4 px-3 py-3 sm:flex-nowrap">
                  {brandLogoSrc(it.name, it.domains, isComp ? 'brand' : 'marketplace') ? (
                    <BrandLogo name={it.name} domain={it.domains} kind={isComp ? 'brand' : 'marketplace'} size={40} decorative className="rounded-full!" />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-[17px] font-bold text-white"
                      style={{ backgroundColor: isComp ? competitorColor(i) : 'var(--color-ink-500)' }}
                    >
                      {isComp ? it.name.charAt(0).toUpperCase() : <ShoppingCart size={18} strokeWidth={ICON_STROKE} />}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="type-h3 text-ink-900">{it.name}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {aliases.map((a) => (
                        <AliasChip key={a}>{a}</AliasChip>
                      ))}
                      {it.domains.length ? (
                        it.domains.map((d) => <DomainChip key={d}>{d}</DomainChip>)
                      ) : (
                        <span className="text-[12px] font-semibold text-ink-500">{isComp ? 'No website · matched by name' : 'No domains yet'}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(it.id)}>Edit</Button>
                  <ConfirmButton onConfirm={() => archive(it)} />
                </div>
                {rowErr?.id === it.id && (
                  <div className="px-3 pb-3">
                    <InlineError>{rowErr.err.message}</InlineError>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
