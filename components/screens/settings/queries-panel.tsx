'use client';

import { useState, type ReactNode } from 'react';
import { History, IndianRupee, MapPin, Pencil, Plus, Truck, type LucideIcon } from 'lucide-react';
import type { Product, Query } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { Button, EmptyState, ICON_STROKE, Input, cn, formatInr } from '@/components/ui';
import { ConfirmButton, FORM_WELL, InlineError, PanelHeader, SelectField, TextArea, fieldError, generalError, num, str, toFormError, type FormError } from './shared';

const KNOWN = ['text', 'productId', 'budgetInr', 'city', 'deadlineDays'];
export const VERSION_NOTE = 'Editing creates a new version; past runs keep the old wording.';

function QueryForm({
  query, products, defaultCity, onCancel, onDone,
}: { query?: Query; products: Product[]; defaultCity: string; onCancel: () => void; onDone: (msg: string) => void }) {
  const [text, setText] = useState(query?.text ?? '');
  const [productId, setProductId] = useState(query?.productId ?? products[0]?.id ?? '');
  const [budget, setBudget] = useState(str(query?.budgetInr ?? 1500));
  const [city, setCity] = useState(query?.city ?? defaultCity);
  const [deadline, setDeadline] = useState(str(query?.deadlineDays ?? 1));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<FormError | null>(null);

  const save = async () => {
    const budgetInr = num(budget);
    const deadlineDays = num(deadline);
    if (budgetInr === null) return setErr({ field: 'budgetInr', message: 'Enter a budget in rupees.' });
    if (deadlineDays === null) return setErr({ field: 'deadlineDays', message: 'Enter a deadline in days (0–14).' });
    setSaving(true);
    setErr(null);
    const body = { text: text.trim(), productId, budgetInr, city: city.trim(), deadlineDays };
    try {
      if (query) {
        await api.updateQuery(query.id, body);
        onDone(`${query.code} saved as a new version`);
      } else {
        const q = await api.createQuery(body);
        onDone(`${q.code ?? 'Query'} added`);
      }
    } catch (e) {
      setErr(toFormError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className={FORM_WELL}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && productId) save();
      }}
    >
      {query && (
        <p className="flex items-center gap-2 type-small text-ink-500">
          <History aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0" />
          Saving makes a new version of {query.code}. Past runs keep the old wording.
        </p>
      )}
      <TextArea
        label="What the shopper asks"
        value={text}
        onChange={setText}
        helper={`${text.trim().length}/500 · at least 10 characters. Write it the way a shopper would.`}
        error={fieldError(err, 'text')}
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SelectField
          label="Product that should win"
          value={productId}
          onChange={setProductId}
          options={products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
          error={fieldError(err, 'productId')}
        />
        <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} error={fieldError(err, 'city')} />
        <Input label="Budget (₹)" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} helper="₹100 to ₹1,00,000" error={fieldError(err, 'budgetInr')} />
        <Input label="Deadline (days)" inputMode="numeric" value={deadline} onChange={(e) => setDeadline(e.target.value)} helper="0 = same day, up to 14" error={fieldError(err, 'deadlineDays')} />
      </div>
      <InlineError>{generalError(err, KNOWN)}</InlineError>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving} disabled={!text.trim() || !productId}>{query ? 'Save new version' : 'Add query'}</Button>
      </div>
    </form>
  );
}

function Pill({ icon: Icon, outline, children }: { icon?: LucideIcon; outline?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-pill px-[9px] text-[12px] font-semibold text-ink-700',
        outline ? 'border border-ink-200 bg-surface-sunken' : 'bg-ink-100',
      )}
    >
      {Icon && <Icon aria-hidden size={14} strokeWidth={ICON_STROKE} />}
      {children}
    </span>
  );
}

/** Pencil "52 Settings – Queries" (SOEdW). */
export function QueriesPanel({ queries, products, defaultCity, onChanged }: { queries: Query[]; products: Product[]; defaultCity: string; onChanged: (msg: string) => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; err: FormError } | null>(null);
  const code = (id: string) => products.find((p) => p.id === id)?.code ?? '—';
  const done = (m: string) => {
    setEditing(null);
    onChanged(m);
  };

  return (
    <div className="flex flex-col gap-1">
      <PanelHeader
        title="Queries"
        sub={`The ${queries.length} shopper question${queries.length === 1 ? '' : 's'} every run asks`}
        action={editing !== 'new' && <Button icon={Plus} onClick={() => setEditing('new')} disabled={!products.length}>Add query</Button>}
      />
      <p className="mb-3 flex min-h-14 items-center gap-3 rounded-inner border border-ink-200 bg-surface-sunken px-[18px] py-2 text-[14px] leading-5 font-medium text-ink-900">
        <History aria-hidden size={20} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-500" />
        {VERSION_NOTE}
      </p>
      {!products.length && <InlineError>Add a product first. Every query names the product that should win it.</InlineError>}
      {editing === 'new' && (
        <div className="pb-3">
          <QueryForm products={products} defaultCity={defaultCity} onCancel={() => setEditing(null)} onDone={done} />
        </div>
      )}
      {queries.length === 0 && editing !== 'new' ? (
        <EmptyState
          title="No queries yet"
          body="Add the questions shoppers ask an AI before they buy. Every run asks each one."
          action={products.length ? <Button icon={Plus} onClick={() => setEditing('new')}>Add query</Button> : undefined}
        />
      ) : (
        <ul className="flex flex-col">
          {queries.map((q) =>
            editing === q.id ? (
              <li key={q.id} className="py-3">
                <QueryForm query={q} products={products} defaultCity={defaultCity} onCancel={() => setEditing(null)} onDone={done} />
              </li>
            ) : (
              <li key={q.id} className="flex flex-col border-b border-ink-200 last:border-b-0">
                <div className="flex min-h-14 items-center gap-3.5 pr-2 pl-3">
                  <span className="w-9 shrink-0 text-[13px] leading-5 font-bold text-ink-400">{q.code}</span>
                  <p className="min-w-0 flex-1 truncate text-[15px] leading-6 font-medium text-ink-900" title={q.text}>{q.text}</p>
                  <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                    <Pill outline>{code(q.productId)}</Pill>
                    <Pill icon={IndianRupee}>{formatInr(q.budgetInr).replace('₹', '')}</Pill>
                    <Pill icon={Truck}>{q.deadlineDays === 0 ? 'Same day' : `${q.deadlineDays} day${q.deadlineDays === 1 ? '' : 's'}`}</Pill>
                    {q.city !== defaultCity && <Pill icon={MapPin}>{q.city}</Pill>}
                  </div>
                  <Button variant="ghost" size="sm" iconOnly icon={Pencil} onClick={() => setEditing(q.id)}>Edit {q.code}</Button>
                  <ConfirmButton
                    iconOnly
                    subject={q.code}
                    onConfirm={async () => {
                      setRowErr(null);
                      try {
                        await api.deleteQuery(q.id);
                        onChanged(`${q.code} archived`);
                      } catch (e) {
                        setRowErr({ id: q.id, err: toFormError(e) });
                      }
                    }}
                  />
                </div>
                {rowErr?.id === q.id && (
                  <div className="px-3 pb-3">
                    <InlineError>{rowErr.err.message}</InlineError>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
