import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toRunDefaults } from '@/lib/mappers';
import { asBody, validateRunDefaults } from '@/lib/settings-validate';
import { nowIso, settingsRow } from '@/lib/settings';

// PATCH /api/settings/run-defaults { attempts?, city?, region?, country?, timezone?, lat?, lng?, extractorModel?, fixesModel? } -> RunDefaults
export const PATCH = route(async (req) => {
  const user = await requireUser();
  const patch = validateRunDefaults(asBody(await readJson(req)));
  if (!Object.keys(patch).length) return json(toRunDefaults(await settingsRow()));
  const row = must(
    await db().from('settings')
      .upsert({ id: 1, ...patch, updated_at: nowIso(), updated_by_email: user.email }, { onConflict: 'id' })
      .select('*').single(),
    'settings',
  );
  return json(toRunDefaults(row));
});
