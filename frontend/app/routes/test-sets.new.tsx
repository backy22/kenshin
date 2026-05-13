import { useEffect, useMemo, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, Link, useActionData, useFetcher, useLoaderData, useNavigation, useOutletContext } from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';
import { readAuthToken } from '../session.server';
import { t, type Locale } from '../i18n';

export const meta: MetaFunction = () => [{ title: 'Add checkup | Kenshin' }];

interface Me {
  id: number;
  role: string;
  name: string;
  email: string;
  location: string | null;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
}

interface ItemRow {
  id: number;
  name: string;
  defaultFrequency: number;
}

export interface RecommendationRow {
  name: string;
  frequencyText: string;
  intervalDays: number;
  rationale?: string | null;
}

type RecommendActionData =
  | { intent: 'recommend'; ok: true; rows: RecommendationRow[] }
  | { intent: 'recommend'; ok: false; error: string };

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');

  const url = new URL(request.url);
  const itemPreview = url.searchParams.get('itemPreview');
  const userPreview = url.searchParams.get('userPreview');

  const baseQuery = `
    query {
      me { id role name email location }
      getAllItems {
        id
        name
        defaultFrequency
      }
    }
  `;

  const data = await gqlRequest<{
    me: Me | null;
    getAllItems: ItemRow[];
    getAllUsers?: UserRow[];
  }>(baseQuery, undefined, token);

  if (!data.me) throw redirect('/login');

  let getAllUsers: UserRow[] | undefined;
  if (data.me.role === 'ADMIN') {
    const adminData = await gqlRequest<{ getAllUsers: UserRow[] }>(
      `query { getAllUsers { id name email } }`,
      undefined,
      token
    );
    getAllUsers = adminData.getAllUsers;
  }

  let suggestedDays: number | null = null;
  if (itemPreview) {
    let suggestUserId = data.me.id;
    if (data.me.role === 'ADMIN' && userPreview && Number.isFinite(Number(userPreview))) {
      suggestUserId = Number(userPreview);
    }
    const sid = await gqlRequest<{ suggestScreeningInterval: number }>(
      `query ($userId: Int!, $itemId: Int!) {
        suggestScreeningInterval(userId: $userId, itemId: $itemId)
      }`,
      { userId: suggestUserId, itemId: Number(itemPreview) },
      token
    );
    suggestedDays = sid.suggestScreeningInterval;
  }

  return json({ ...data, getAllUsers, suggestedDays, itemPreview });
}

export async function action({ request }: ActionFunctionArgs) {
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');

  const form = await request.formData();
  const intent = String(form.get('_intent') ?? 'create');

  if (intent === 'recommend') {
    const loc = String(form.get('aiLocation') ?? '').trim() || null;
    const forUserRaw = form.get('forUserId');
    const forUserId =
      forUserRaw != null && String(forUserRaw).trim() !== '' && Number.isFinite(Number(forUserRaw))
        ? Number(forUserRaw)
        : null;
    const variables: Record<string, unknown> = { loc, forUserId };
    const query = `
      query Rec($loc: String, $forUserId: Int) {
        recommendCheckups(locationOverride: $loc, forUserId: $forUserId) {
          name
          frequencyText
          intervalDays
          rationale
        }
      }
    `;
    try {
      const data = await gqlRequest<{ recommendCheckups: RecommendationRow[] }>(query, variables, token);
      return json({ intent: 'recommend', ok: true as const, rows: data.recommendCheckups } satisfies RecommendActionData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      return json({ intent: 'recommend', ok: false as const, error: msg } satisfies RecommendActionData);
    }
  }

  if (intent === 'applyRecommendations') {
    const userId = Number(form.get('userId'));
    if (!Number.isFinite(userId) || userId < 1) {
      return json({ error: 'Invalid user' }, { status: 400 });
    }
    const rowsRaw = String(form.get('rows') ?? '[]');
    let rows: { name: string; intervalDays: number; frequencyText?: string | null; whereGuidanceEn?: string | null }[];
    try {
      rows = JSON.parse(rowsRaw);
    } catch {
      return json({ error: 'Invalid selection payload' }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ error: 'Select at least one suggestion' }, { status: 400 });
    }
    const mutation = `
      mutation Apply($userId: Int!, $rows: [RecommendationApplyInput!]!) {
        applyRecommendations(userId: $userId, rows: $rows) {
          id
        }
      }
    `;
    await gqlRequest(mutation, { userId, rows }, token);
    return redirect('/');
  }

  const userId = Number(form.get('userId'));
  const itemId = Number(form.get('itemId'));
  const frequency = Number(form.get('frequency'));
  const nextDate = String(form.get('nextDate'));
  const reminderLeadDays = Number(form.get('reminderLeadDays') || 14);

  const mutation = `
    mutation CreateTestSet($testSetData: TestSetInput!) {
      createTestSet(testSetData: $testSetData) {
        id
      }
    }
  `;

  await gqlRequest(
    mutation,
    {
      testSetData: {
        userId,
        itemId,
        frequency,
        nextDate,
        reminderLeadDays,
      },
    },
    token
  );
  return redirect('/');
}

export default function NewTestSet() {
  const { me, getAllItems, getAllUsers, suggestedDays, itemPreview } = useLoaderData<typeof loader>();
  const outlet = useOutletContext<{ locale?: Locale } | undefined>();
  const locale = outlet?.locale ?? 'en';
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const previewFetcher = useFetcher<typeof loader>();
  const aiFetcher = useFetcher<RecommendActionData>();

  const [selectedItem, setSelectedItem] = useState(itemPreview ?? '');
  const [adminTargetUserId, setAdminTargetUserId] = useState<string>(
    me?.role === 'ADMIN' ? '' : String(me?.id ?? '')
  );
  const [aiLocation, setAiLocation] = useState(me?.location ?? '');
  const [selectedAiRows, setSelectedAiRows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!me || !selectedItem) return;
    let url = `/test-sets/new?itemPreview=${encodeURIComponent(selectedItem)}`;
    if (me.role === 'ADMIN' && adminTargetUserId.trim() !== '') {
      url += `&userPreview=${encodeURIComponent(adminTargetUserId)}`;
    }
    previewFetcher.load(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, adminTargetUserId, me?.id, me?.role]);

  const recommendRows = useMemo(() => {
    if (aiFetcher.data?.intent === 'recommend' && aiFetcher.data.ok) return aiFetcher.data.rows;
    return null;
  }, [aiFetcher.data]);

  useEffect(() => {
    if (!recommendRows) return;
    const next: Record<number, boolean> = {};
    recommendRows.forEach((_, i) => {
      next[i] = true;
    });
    setSelectedAiRows(next);
  }, [recommendRows]);

  if (!me) {
    return null;
  }

  const suggested = previewFetcher.data?.suggestedDays ?? suggestedDays;
  const isSubmitting = navigation.state === 'submitting';
  const aiBusy = aiFetcher.state === 'submitting';

  const scheduleUserId =
    me.role === 'ADMIN' ? (adminTargetUserId.trim() !== '' ? adminTargetUserId : '') : String(me.id);

  const requestRecommendations = () => {
    const fd = new FormData();
    fd.set('_intent', 'recommend');
    fd.set('aiLocation', aiLocation);
    if (me.role === 'ADMIN' && scheduleUserId) {
      fd.set('forUserId', scheduleUserId);
    }
    aiFetcher.submit(fd, { method: 'post' });
  };

  const applySelectedRecommendations = () => {
    if (!recommendRows || !scheduleUserId) return;
    const rows = recommendRows
      .map((r, i) =>
        selectedAiRows[i]
          ? {
              name: r.name,
              intervalDays: r.intervalDays,
              frequencyText: r.frequencyText,
              whereGuidanceEn: r.rationale ?? null,
            }
          : null
      )
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (rows.length === 0) return;
    const fd = new FormData();
    fd.set('_intent', 'applyRecommendations');
    fd.set('userId', scheduleUserId);
    fd.set('rows', JSON.stringify(rows));
    aiFetcher.submit(fd, { method: 'post' });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">{t(locale, 'navNewCheckup')}</h1>

      {actionData?.error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {actionData.error}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border border-amber-100 bg-amber-50/60 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">{t(locale, 'aiRecommendTitle')}</h2>
        <p className="mt-2 text-sm text-amber-900">{t(locale, 'aiRecommendDisclaimer')}</p>
        <div className="mt-4 space-y-3">
          {me.role === 'ADMIN' ? (
            <div>
              <label htmlFor="aiForUser" className="block text-sm font-medium text-gray-800">
                User (for suggestions)
              </label>
              <select
                id="aiForUser"
                value={adminTargetUserId}
                onChange={(e) => setAdminTargetUserId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              >
                <option value="">Select a user</option>
                {getAllUsers?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label htmlFor="aiLocation" className="block text-sm font-medium text-gray-800">
              {t(locale, 'aiLocationOverride')}
            </label>
            <input
              id="aiLocation"
              type="text"
              value={aiLocation}
              onChange={(e) => setAiLocation(e.target.value)}
              placeholder={me.location ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                aiBusy || (me.role === 'ADMIN' && (!adminTargetUserId || Number(adminTargetUserId) < 1))
              }
              onClick={requestRecommendations}
              className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiBusy ? t(locale, 'aiSuggestionsLoading') : t(locale, 'aiGetSuggestions')}
            </button>
            {aiFetcher.data?.intent === 'recommend' && !aiFetcher.data.ok ? (
              <span className="text-sm text-red-700">{aiFetcher.data.error}</span>
            ) : null}
          </div>
        </div>

        {recommendRows && recommendRows.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-md border border-amber-200 bg-white">
            <div className="flex flex-wrap gap-2 border-b border-amber-100 px-3 py-2">
              <button
                type="button"
                className="text-xs font-medium text-amber-900 underline"
                onClick={() => {
                  const next: Record<number, boolean> = {};
                  recommendRows.forEach((_, i) => {
                    next[i] = true;
                  });
                  setSelectedAiRows(next);
                }}
              >
                {t(locale, 'aiSelectAll')}
              </button>
              <button
                type="button"
                className="text-xs font-medium text-amber-900 underline"
                onClick={() => {
                  const next: Record<number, boolean> = {};
                  recommendRows.forEach((_, i) => {
                    next[i] = false;
                  });
                  setSelectedAiRows(next);
                }}
              >
                {t(locale, 'aiSelectNone')}
              </button>
            </div>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-3 py-2 text-left font-medium text-gray-700" />
                  <th className="px-3 py-2 text-left font-medium text-gray-700">{t(locale, 'aiTableName')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">{t(locale, 'aiTableFrequency')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">{t(locale, 'aiTableDays')}</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">{t(locale, 'aiTableNote')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recommendRows.map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!selectedAiRows[i]}
                        onChange={(e) => setSelectedAiRows((prev) => ({ ...prev, [i]: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                    <td className="px-3 py-2 text-gray-700">{r.frequencyText}</td>
                    <td className="px-3 py-2 text-gray-600">{r.intervalDays}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-gray-500" title={r.rationale ?? ''}>
                      {r.rationale ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-amber-100 px-3 py-3">
              <button
                type="button"
                disabled={aiBusy || !scheduleUserId}
                onClick={applySelectedRecommendations}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                {t(locale, 'aiAddSelected')}
              </button>
            </div>
          </div>
        ) : aiFetcher.data?.intent === 'recommend' && aiFetcher.data.ok && recommendRows?.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">{t(locale, 'aiNoSuggestions')}</p>
        ) : null}
      </section>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t(locale, 'testItem')}</h2>
        <Form method="post" className="space-y-6">
          <input type="hidden" name="_intent" value="create" />
          {me.role === 'ADMIN' ? (
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                User
              </label>
              <select
                id="userId"
                name="userId"
                required
                value={adminTargetUserId}
                onChange={(e) => setAdminTargetUserId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              >
                <option value="">Select a user</option>
                {getAllUsers?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="userId" value={me.id} />
          )}

          <div>
            <label htmlFor="itemId" className="block text-sm font-medium text-gray-700">
              {t(locale, 'testItem')}
            </label>
            <select
              id="itemId"
              name="itemId"
              required
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              <option value="">{t(locale, 'testItem')}</option>
              {getAllItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (default {item.defaultFrequency} days)
                </option>
              ))}
            </select>
            {suggested != null && selectedItem ? (
              <p className="mt-2 text-sm text-indigo-700">
                Guideline suggestion for your profile: every <strong>{suggested}</strong> days (you can override
                below).
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">
              {t(locale, 'frequencyInput')}
            </label>
            <input
              type="number"
              id="frequency"
              name="frequency"
              required
              min={1}
              key={`${selectedItem}-${suggested ?? 'x'}`}
              defaultValue={
                suggested ?? getAllItems.find((i) => String(i.id) === selectedItem)?.defaultFrequency ?? ''
              }
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="nextDate" className="block text-sm font-medium text-gray-700">
              {t(locale, 'nextCheckup')}
            </label>
            <input
              type="date"
              id="nextDate"
              name="nextDate"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="reminderLeadDays" className="block text-sm font-medium text-gray-700">
              {t(locale, 'reminderLeadInput')}
            </label>
            <input
              type="number"
              id="reminderLeadDays"
              name="reminderLeadDays"
              min={1}
              defaultValue={14}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Link
              to="/"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-75"
            >
              {isSubmitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
