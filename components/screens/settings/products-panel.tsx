'use client';

import { useState } from 'react';
import { ExternalLink, Pencil, Plus, Shirt, Truck } from 'lucide-react';
import type { Product, Query } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { Button, EmptyState, ICON_STROKE, Input, Toggle, formatInr } from '@/components/ui';
import { ConfirmButton, FORM_WELL, InlineError, PanelHeader, TagInput, fieldError, generalError, num, str, toFormError, type FormError } from './shared';

const KNOWN = ['code', 'name', 'url', 'priceInr', 'mrpInr', 'sizes', 'fabric', 'style', 'deliveryDays', 'deliveryIsSample'];

function ProductForm({ product, nextCode, onCancel, onDone }: { product?: Product; nextCode: string; onCancel: () => void; onDone: (msg: string) => void }) {
  const [f, setF] = useState({
    code: product?.code ?? nextCode,
    name: product?.name ?? '',
    url: product?.url ?? '',
    priceInr: str(product?.priceInr),
    mrpInr: str(product?.mrpInr),
    fabric: product?.fabric ?? '',
    style: product?.style ?? '',
    deliveryDays: str(product?.deliveryDays),
  });
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [sample, setSample] = useState(product?.deliveryIsSample ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<FormError | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    const price = num(f.priceInr);
    if (price === null) {
      setErr({ field: 'priceInr', message: 'Enter the selling price in rupees.' });
      return;
    }
    setSaving(true);
    setErr(null);
    const body = {
      code: f.code.trim(), name: f.name.trim(), url: f.url.trim(), priceInr: price, mrpInr: num(f.mrpInr), sizes,
      fabric: f.fabric.trim(), style: f.style.trim(), deliveryDays: num(f.deliveryDays), deliveryIsSample: sample,
    };
    try {
      if (product) await api.updateProduct(product.id, body);
      else await api.createProduct(body);
      onDone(product ? `${body.code} saved` : `${body.code} added`);
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
        if (f.name.trim() && f.code.trim()) save();
      }}
    >
      <div className="grid grid-cols-[120px_1fr] gap-5">
        <Input label="Code" value={f.code} onChange={set('code')} error={fieldError(err, 'code')} />
        <Input label="Product name" value={f.name} autoFocus onChange={set('name')} error={fieldError(err, 'name')} />
      </div>
      <Input label="Product page URL" type="url" value={f.url} onChange={set('url')} placeholder="https://" error={fieldError(err, 'url')} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Input label="Price (₹)" inputMode="numeric" value={f.priceInr} onChange={set('priceInr')} error={fieldError(err, 'priceInr')} />
        <Input label="MRP (₹)" inputMode="numeric" value={f.mrpInr} onChange={set('mrpInr')} helper="Optional" error={fieldError(err, 'mrpInr')} />
        <Input label="Delivery (days)" inputMode="numeric" value={f.deliveryDays} onChange={set('deliveryDays')} helper="Empty if unknown" error={fieldError(err, 'deliveryDays')} />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Input label="Fabric" value={f.fabric} onChange={set('fabric')} error={fieldError(err, 'fabric')} />
        <TagInput label="Sizes" values={sizes} onChange={setSizes} placeholder="S, M, L… press Enter" error={fieldError(err, 'sizes')} />
      </div>
      <Input label="Style" value={f.style} onChange={set('style')} error={fieldError(err, 'style')} />
      <label className="flex items-center justify-between gap-4 rounded-input bg-surface-sunken px-4 py-3">
        <span className="flex flex-col">
          <span className="type-body-strong text-ink-900">Delivery promise is a sample</span>
          <span className="type-small text-ink-500">Turn off once the next-day Mumbai promise is confirmed.</span>
        </span>
        <Toggle label="Delivery promise is a sample" checked={sample} onCheckedChange={setSample} />
      </label>
      <InlineError>{generalError(err, KNOWN)}</InlineError>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving} disabled={!f.name.trim() || !f.code.trim()}>{product ? 'Save' : 'Add product'}</Button>
      </div>
    </form>
  );
}

/** Products (no frame yet; same row pattern as Competitors). */
export function ProductsPanel({ products, queries, brandName, onChanged }: { products: Product[]; queries: Query[]; brandName: string; onChanged: (msg: string) => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [rowErr, setRowErr] = useState<{ id: string; err: FormError } | null>(null);
  const maxN = products.reduce((m, p) => Math.max(m, Number(/^P(\d+)$/i.exec(p.code)?.[1] ?? 0)), 0);
  const nextCode = `P${maxN + 1}`;
  const usedBy = (id: string) => queries.filter((q) => q.productId === id).map((q) => q.code);
  const done = (m: string) => {
    setEditing(null);
    onChanged(m);
  };

  return (
    <div className="flex flex-col gap-2">
      <PanelHeader
        title="Products"
        sub={`The ${brandName} products each query should win`}
        action={editing !== 'new' && <Button icon={Plus} onClick={() => setEditing('new')}>Add product</Button>}
      />
      {editing === 'new' && <ProductForm nextCode={nextCode} onCancel={() => setEditing(null)} onDone={done} />}
      {products.length === 0 && editing !== 'new' ? (
        <EmptyState
          title="No products yet"
          body="Add the products you want AI shoppers to pick. Each query names one."
          action={<Button icon={Plus} onClick={() => setEditing('new')}>Add product</Button>}
        />
      ) : (
        <ul className="flex flex-col">
          {products.map((p) => {
            if (editing === p.id) {
              return (
                <li key={p.id} className="py-3">
                  <ProductForm product={p} nextCode={nextCode} onCancel={() => setEditing(null)} onDone={done} />
                </li>
              );
            }
            const used = usedBy(p.id);
            return (
              <li key={p.id} className="flex flex-col border-b border-ink-200 last:border-b-0">
                <div className="flex min-h-[76px] items-center gap-4 px-3 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Shirt aria-hidden size={20} strokeWidth={ICON_STROKE} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-6 shrink-0 items-center rounded-pill border border-ink-200 bg-surface-sunken px-[9px] text-[12px] font-semibold text-ink-700">{p.code}</span>
                      <span className="truncate type-h3 text-ink-900" title={p.name}>{p.name}</span>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Open ${p.name}`} className="shrink-0 text-ink-400 hover:text-brand-600">
                          <ExternalLink aria-hidden size={14} strokeWidth={ICON_STROKE} />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-small text-ink-500">
                      <span className="font-semibold text-ink-900">{formatInr(p.priceInr)}</span>
                      {p.mrpInr != null && p.mrpInr > p.priceInr && <span className="line-through">{formatInr(p.mrpInr)}</span>}
                      <span>{p.sizes.length ? p.sizes.join(' · ') : 'Sizes —'}</span>
                      {p.fabric && <span>{p.fabric}</span>}
                      <span className="inline-flex items-center gap-1">
                        <Truck aria-hidden size={14} strokeWidth={ICON_STROKE} />
                        {p.deliveryDays == null ? 'Delivery —' : `${p.deliveryDays} day${p.deliveryDays === 1 ? '' : 's'}`}
                        {p.deliveryIsSample && ' · sample'}
                      </span>
                      <span>{used.length ? `Used by ${used.join(', ')}` : 'No queries yet'}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(p.id)}>Edit</Button>
                  <ConfirmButton
                    onConfirm={async () => {
                      setRowErr(null);
                      try {
                        await api.deleteProduct(p.id);
                        onChanged(`${p.code} archived`);
                      } catch (e) {
                        setRowErr({ id: p.id, err: toFormError(e) });
                      }
                    }}
                  />
                </div>
                {rowErr?.id === p.id && (
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
