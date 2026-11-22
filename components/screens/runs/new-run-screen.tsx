'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '../app-shell';
import { ICON_STROKE } from '../ui';
import { PlanRunForm } from './plan-run-form';

/** /runs/new: plan and start a full run (was the "Plan a run" modal). */
export function NewRunScreen() {
  return (
    <AppShell active="runs">
      <div className="flex flex-col gap-5">
        <Link
          href="/runs"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-pill pr-4 pl-3 type-small font-semibold text-ink-700 transition-colors hover:bg-surface hover:text-ink-900"
        >
          <ArrowLeft aria-hidden size={18} strokeWidth={ICON_STROKE} />
          Back to runs
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="type-display text-ink-900">Send AI shoppers</h1>
          <p className="type-body text-ink-500">Choose what to ask and who to ask</p>
        </div>
      </div>
      <PlanRunForm />
    </AppShell>
  );
}
