import { useEffect, useMemo, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, Link, useActionData, useFetcher, useLoaderData, useNavigation, useOutletContext } from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';
import { readAuthToken } from '../session.server';
import { t, type Locale } from '../i18n';

export const meta: MetaFunction = () => [{ title: 'Add checkup | Kenshin' }];

/** Schedule form: same vertical/horizontal padding and type scale as Test item. */
const scheduleFieldClass =
  'mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 pl-3 text-base shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500';
const scheduleSelectClass = `${scheduleFieldClass} pr-10`;
const scheduleInputClass = `${scheduleFieldClass} pr-3`;

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
    // Logs the Remix server process (not the FastAPI Docker container).
    console.info('[kenshin] recommendCheckups action', { forUserId, locationLen: (loc ?? '').length });
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
      console.info('[kenshin] recommendCheckups GraphQL ok', { count: data.recommendCheckups.length });
      return json({ intent: 'recommend', ok: true as const, rows: data.recommendCheckups } satisfies RecommendActionData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      return json({ intent: 'recommend', ok: false as const, error: msg } satisfies RecommendActionData);
    }
  }

  const userId = Number(form.get('userId'));
  const frequency = Number(form.get('frequency'));
  const nextDate = String(form.get('nextDate'));
  const reminderLeadDays = Number(form.get('reminderLeadDays') || 14);

  const recRowRaw = String(form.get('recommendationRow') ?? '').trim();
  if (recRowRaw) {
    let row: {
      name: string;
      intervalDays?: number;
      interval_days?: number;
      frequencyText?: string | null;
      rationale?: string | null;
    };
    try {
      row = JSON.parse(recRowRaw);
    } catch {
      return json({ error: 'Invalid suggestion payload' }, { status: 400 });
    }
    if (!Number.isFinite(userId) || userId < 1) {
      return json({ error: 'Invalid user' }, { status: 400 });
    }
    if (!Number.isFinite(frequency) || frequency < 1) {
      return json({ error: 'Invalid frequency' }, { status: 400 });
    }
    const name = String(row.name ?? '').trim();
    if (!name) {
      return json({ error: 'Invalid suggestion name' }, { status: 400 });
    }
    const where =
      (row.rationale != null && String(row.rationale).trim()) ||
      (row.frequencyText != null && String(row.frequencyText).trim()) ||
      null;
    const createPersonal = `
      mutation CreatePersonal($name: String!, $defaultFrequency: Int!, $whereGuidanceEn: String) {
        createPersonalItem(name: $name, defaultFrequency: $defaultFrequency, whereGuidanceEn: $whereGuidanceEn) {
          id
        }
      }
    `;
    const itemRes = await gqlRequest<{ createPersonalItem: { id: number } }>(
      createPersonal,
      {
        name,
        defaultFrequency: frequency,
        whereGuidanceEn: where,
      },
      token
    );
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
          itemId: itemRes.createPersonalItem.id,
          frequency,
          nextDate,
          reminderLeadDays,
        },
      },
      token
    );
    return redirect('/');
  }

  const itemId = Number(form.get('itemId'));
  if (!Number.isFinite(itemId) || itemId < 1) {
    return json({ error: 'Select a catalog test item' }, { status: 400 });
  }

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
  const [recommendGateError, setRecommendGateError] = useState<string | null>(null);
  const [frequencyDays, setFrequencyDays] = useState<number | ''>(() => {
    if (typeof suggestedDays === 'number' && suggestedDays > 0) return suggestedDays;
    if (itemPreview) {
      const it = getAllItems.find((i) => String(i.id) === String(itemPreview));
      return it?.defaultFrequency ?? '';
    }
    return '';
  });

  useEffect(() => {
    if (!me || !selectedItem) return;
    if (!/^\d+$/.test(selectedItem)) return;
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
    if (aiFetcher.data?.intent !== 'recommend' || !aiFetcher.data.ok) return;
    if (!aiFetcher.data.rows.length) return;
    setSelectedItem('');
    setFrequencyDays('');
  }, [aiFetcher.data]);

  useEffect(() => {
    if (!selectedItem || !/^\d+$/.test(selectedItem)) return;
    const s = previewFetcher.data?.suggestedDays;
    if (typeof s === 'number' && s > 0) setFrequencyDays(s);
  }, [selectedItem, previewFetcher.data?.suggestedDays]);

  const selectedRecommendationJson = useMemo(() => {
    if (!recommendRows?.length || !selectedItem.startsWith('rec:')) return '';
    const i = Number(selectedItem.slice(4));
    const r = recommendRows[i];
    return r ? JSON.stringify(r) : '';
  }, [recommendRows, selectedItem]);

  const usingAiItems = !!(recommendRows && recommendRows.length > 0);

  if (!me) {
    return null;
  }

  const suggested = previewFetcher.data?.suggestedDays ?? suggestedDays;
  const isSubmitting = navigation.state === 'submitting';
  const aiBusy = aiFetcher.state === 'submitting';

  const scheduleUserId =
    me.role === 'ADMIN' ? (adminTargetUserId.trim() !== '' ? adminTargetUserId : '') : String(me.id);

  const requestRecommendations = () => {
    setRecommendGateError(null);
    if (me.role === 'ADMIN' && (!adminTargetUserId.trim() || Number(adminTargetUserId) < 1)) {
      setRecommendGateError(t(locale, 'aiSelectUserForSuggestions'));
      return;
    }
    const fd = new FormData();
    fd.set('_intent', 'recommend');
    fd.set('aiLocation', aiLocation);
    if (me.role === 'ADMIN' && scheduleUserId) {
      fd.set('forUserId', scheduleUserId);
    }
    aiFetcher.submit(fd, { method: 'post', action: '/test-sets/new' });
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
                className={scheduleSelectClass}
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
              disabled={aiBusy}
              onClick={requestRecommendations}
              className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiBusy ? t(locale, 'aiSuggestionsLoading') : t(locale, 'aiGetSuggestions')}
            </button>
            {recommendGateError ? <span className="text-sm text-red-700">{recommendGateError}</span> : null}
            {aiFetcher.data?.intent === 'recommend' && !aiFetcher.data.ok ? (
              <span className="text-sm text-red-700">{aiFetcher.data.error}</span>
            ) : null}
          </div>
          {me.role === 'ADMIN' && !adminTargetUserId ? (
            <p className="text-sm text-amber-900">{t(locale, 'aiSelectUserForSuggestions')}</p>
          ) : null}
          {aiFetcher.data?.intent === 'recommend' && aiFetcher.data.ok && recommendRows && recommendRows.length > 0 ? (
            <p className="text-sm text-green-800">{t(locale, 'aiSuggestSuccess', { count: recommendRows.length })}</p>
          ) : null}
          {aiFetcher.data?.intent === 'recommend' && aiFetcher.data.ok && recommendRows?.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">{t(locale, 'aiNoSuggestions')}</p>
          ) : null}
          {usingAiItems ? (
            <p className="text-sm text-amber-900">{t(locale, 'aiUseTestItemBelow')}</p>
          ) : null}
        </div>
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
                className={scheduleSelectClass}
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
              onChange={(e) => {
                const v = e.target.value;
                setSelectedItem(v);
                if (v.startsWith('rec:')) {
                  const idx = Number(v.slice(4));
                  if (recommendRows?.[idx]) setFrequencyDays(recommendRows[idx].intervalDays);
                } else if (/^\d+$/.test(v)) {
                  const item = getAllItems.find((x) => String(x.id) === v);
                  setFrequencyDays(item?.defaultFrequency ?? '');
                } else {
                  setFrequencyDays('');
                }
              }}
              className={scheduleSelectClass}
            >
              <option value="">{usingAiItems ? t(locale, 'testItemPickSuggestion') : t(locale, 'testItem')}</option>
              {usingAiItems
                ? recommendRows!.map((r, i) => (
                    <option key={`rec-${i}-${r.name}`} value={`rec:${i}`}>
                      {r.name}
                    </option>
                  ))
                : getAllItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (default {item.defaultFrequency} days)
                    </option>
                  ))}
            </select>
            {selectedRecommendationJson ? <input type="hidden" name="recommendationRow" value={selectedRecommendationJson} /> : null}
            {!usingAiItems && suggested != null && /^\d+$/.test(selectedItem) ? (
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
              value={frequencyDays === '' ? '' : frequencyDays}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') setFrequencyDays('');
                else setFrequencyDays(Number(raw));
              }}
              className={scheduleInputClass}
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
              className={scheduleInputClass}
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
              className={scheduleInputClass}
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
