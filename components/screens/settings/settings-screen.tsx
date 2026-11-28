'use client';

import { useSelectedLayoutSegment } from 'next/navigation';
import { Bot, MessageSquareText, Shirt, ShoppingCart, SlidersHorizontal, Store, Swords, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { AppShell, ErrorNote, Skeleton } from '../app-shell';
import { runDateLabel } from '../format';
import { VerticalTab, cn } from '../ui';
import { AssistantsPanel } from './assistants-panel';
import { BrandPanel } from './brand-panel';
import { BrandsPanel } from './brands-panel';
import { ProductsPanel } from './products-panel';
import { QueriesPanel } from './queries-panel';
import { RunDefaultsPanel } from './run-defaults-panel';
import { useToast, type ToastTone } from './shared';

export const SETTINGS_TABS = [
  { slug: 'brand', label: 'Brand', icon: Store },
  { slug: 'products', label: 'Products', icon: Shirt },
  { slug: 'competitors', label: 'Competitors', icon: Swords },
  { slug: 'marketplaces', label: 'Marketplaces', icon: ShoppingCart },
  { slug: 'queries', label: 'Queries', icon: MessageSquareText },
  { slug: 'assistants', label: 'Assistants', icon: Bot },
  { slug: 'run-defaults', label: 'Run defaults', icon: SlidersHorizontal },
] as const satisfies readonly { slug: string; label: string; icon: LucideIcon }[];

export type SettingsTab = (typeof SETTINGS_TABS)[number]['slug'];

const isTab = (s: string | null): s is SettingsTab => SETTINGS_TABS.some((t) => t.slug === s);

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

/** Pencil "50–53 Settings" (pC37k, UrbFe, SOEdW, n4AOWA): vertical tabs + one white content card. */
export function SettingsScreen() {
  const segment = useSelectedLayoutSegment();
  const settings = useApi('settings', api.settings);
  const toast = useToast();

  // /settings (and any unknown segment) lands on Brand.
  const tab: SettingsTab = isTab(segment) ? segment : 'brand';

  const notify = (title: string, tone: ToastTone = 'success') => toast.show({ title, tone });
  const changed = (title: string, tone: ToastTone = 'success') => {
    notify(title, tone);
    settings.reload();
  };

  const s = settings.data;
  const who = s?.updatedByEmail ? s.updatedByEmail.split('@')[0] : null;
  const whoName = who ? who.charAt(0).toUpperCase() + who.slice(1) : null;
  const sub = ['What we track and how the AI shoppers run', s?.updatedAt ? `last changed${whoName ? ` by ${whoName}` : ''}, ${runDateLabel(s.updatedAt)}` : null]
    .filter(Boolean)
    .join(' · ');

  const panel = () => {
    if (!s && !settings.error) return <PanelSkeleton />;
    if (!s) return <ErrorNote error={settings.error!} onRetry={settings.reload} />;
    switch (tab) {
      case 'brand':
        return <BrandPanel key={JSON.stringify(s.brand)} brand={s.brand} onSaved={changed} />;
      case 'products':
        return <ProductsPanel products={s.products} queries={s.queries} brandName={s.brand.name} onChanged={changed} />;
      case 'competitors':
        return <BrandsPanel kind="competitor" items={s.competitors} onChanged={changed} />;
      case 'marketplaces':
        return <BrandsPanel kind="marketplace" items={s.marketplaces} onChanged={changed} />;
      case 'queries':
        return <QueriesPanel queries={s.queries} products={s.products} defaultCity={s.runDefaults.city} onChanged={changed} />;
      case 'assistants':
        return <AssistantsPanel assistants={s.assistants} onChanged={changed} />;
      case 'run-defaults':
        return (
          <RunDefaultsPanel
            key={JSON.stringify(s.runDefaults)}
            defaults={s.runDefaults}
            queryCount={s.queries.length}
            assistantCount={s.assistants.filter((a) => a.enabled).length}
            onSaved={changed}
          />
        );
    }
  };

  return (
    <AppShell active="settings">
      <header className="flex flex-col gap-2 pt-2">
        <h1 className="type-display text-ink-900">Settings</h1>
        <p className="type-body text-ink-500">{sub}</p>
      </header>

      <div className="-mt-2 flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav aria-label="Settings sections" className="-mx-6 flex shrink-0 gap-1 overflow-x-auto px-6 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:w-[282px] lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {SETTINGS_TABS.map((t) => (
            <span key={t.slug} className="relative shrink-0 lg:w-full">
              <VerticalTab
                href={`/settings/${t.slug}`}
                label={t.label}
                icon={t.icon}
                active={tab === t.slug}
                className="lg:max-w-none"
              />
            </span>
          ))}
        </nav>

        <section
          className={cn(
            'flex min-w-0 flex-1 flex-col rounded-card border border-ink-100 bg-surface px-6 pt-7 pb-6 elevation-card sm:px-8',
          )}
        >
          {panel()}
        </section>
      </div>
      {toast.node}
    </AppShell>
  );
}
