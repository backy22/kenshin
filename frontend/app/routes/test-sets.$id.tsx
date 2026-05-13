import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useOutletContext,
  useSearchParams,
} from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';
import { readAuthToken } from '../session.server';
import { t, type Locale } from '../i18n';

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.title ?? 'Schedule | Kenshin' },
];

interface HistoryRow {
  id: number;
  userId: number;
  date: string;
  clinic: string;
  result: string;
}

interface TestSetDetail {
  id: number;
  userId: number;
  itemId: number;
  frequency: number;
  nextDate: string;
  reminderLeadDays: number;
  lastReminderAt: string | null;
  user: { id: number; name: string; email: string; role: string };
  item: { id: number; name: string; defaultFrequency: number; whereGuidanceEn: string | null };
  histories: HistoryRow[];
}

interface ItemOption {
  id: number;
  name: string;
  defaultFrequency: number;
}

/** Calendar date in local TZ (avoids UTC midnight shifting the day). */
function parseLocalDateOnly(iso: string): Date {
  const part = (iso.split('T')[0] ?? iso).split('-');
  const y = Number(part[0]);
  const m = Number(part[1]);
  const d = Number(part[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(iso);
  return new Date(y, m - 1, d);
}

function toDateInput(iso: string): string {
  const d = parseLocalDateOnly(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Fixed locale so SSR + browser produce the same string for the same stored date. */
function formatVisitHeading(iso: string): string {
  const d = parseLocalDateOnly(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');

  const id = Number(params.id);
  if (!Number.isFinite(id) || id < 1) {
    throw redirect('/');
  }

  const query = `
    query One($id: Int!) {
      getTestSetById(id: $id) {
        id
        userId
        itemId
        frequency
        nextDate
        reminderLeadDays
        lastReminderAt
        user { id name email role }
        item { id name defaultFrequency whereGuidanceEn }
        histories { id userId date clinic result }
      }
      getAllItems { id name defaultFrequency }
      me { id role }
    }
  `;

  try {
    const data = await gqlRequest<{
      getTestSetById: TestSetDetail;
      getAllItems: ItemOption[];
      me: { id: number; role: string } | null;
    }>(query, { id }, token);

    if (!data.me) throw redirect('/login');

    return json({
      testSet: data.getTestSetById,
      items: data.getAllItems,
      title: `Edit: ${data.getTestSetById.item.name} | Kenshin`,
    });
  } catch (e) {
    console.error(e);
    throw redirect('/');
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');

  const id = Number(params.id);
  if (!Number.isFinite(id) || id < 1) {
    return json({ error: 'Invalid schedule' }, { status: 400 });
  }

  const form = await request.formData();
  const intent = String(form.get('_action') ?? 'update');

  try {
    if (intent === 'addHistory') {
      const mutation = `
        mutation AddHist($historyData: HistoryInput!) {
          createHistory(historyData: $historyData) { id }
        }
      `;
      await gqlRequest(
        mutation,
        {
          historyData: {
            userId: Number(form.get('historyUserId')),
            date: String(form.get('visitDate')),
            clinic: String(form.get('clinic') ?? '').trim(),
            result: String(form.get('result') ?? '').trim(),
            testSetId: id,
          },
        },
        token
      );
      return redirect(`/test-sets/${id}?added=1`);
    }

    if (intent === 'updateHistory') {
      const historyId = Number(form.get('historyId'));
      if (!Number.isFinite(historyId) || historyId < 1) {
        return json({ error: 'Invalid visit' }, { status: 400 });
      }
      const mutation = `
        mutation UpdHist($historyId: Int!, $historyData: HistoryInput!) {
          updateHistory(historyId: $historyId, historyData: $historyData)
        }
      `;
      await gqlRequest(
        mutation,
        {
          historyId,
          historyData: {
            userId: Number(form.get('historyUserId')),
            date: String(form.get('editVisitDate')),
            clinic: String(form.get('editClinic') ?? '').trim(),
            result: String(form.get('editResult') ?? '').trim(),
            testSetId: id,
          },
        },
        token
      );
      return redirect(`/test-sets/${id}?historyUpdated=1`);
    }

    if (intent === 'deleteHistory') {
      const historyId = Number(form.get('historyId'));
      if (!Number.isFinite(historyId) || historyId < 1) {
        return json({ error: 'Invalid visit' }, { status: 400 });
      }
      const mutation = `
        mutation DelHist($historyId: Int!) {
          deleteHistory(historyId: $historyId)
        }
      `;
      await gqlRequest(mutation, { historyId }, token);
      return redirect(`/test-sets/${id}?historyDeleted=1`);
    }

    if (intent === 'update') {
      const mutation = `
        mutation Upd($testSetId: Int!, $testSetData: TestSetInput!) {
          updateTestSet(testSetId: $testSetId, testSetData: $testSetData)
        }
      `;
      await gqlRequest(
        mutation,
        {
          testSetId: id,
          testSetData: {
            userId: Number(form.get('userId')),
            itemId: Number(form.get('itemId')),
            frequency: Number(form.get('frequency')),
            nextDate: String(form.get('nextDate')),
            reminderLeadDays: Number(form.get('reminderLeadDays') || 14),
          },
        },
        token
      );
      return redirect(`/test-sets/${id}?saved=1`);
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return json({ error: message }, { status: 400 });
  }
}

export default function EditTestSetRoute() {
  const { testSet, items } = useLoaderData<typeof loader>();
  const outlet = useOutletContext<{ locale?: Locale } | undefined>();
  const locale = outlet?.locale ?? 'en';
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const busy = navigation.state === 'submitting';

  const savedFlag = searchParams.get('saved') === '1';
  const addedFlag = searchParams.get('added') === '1';
  const historyUpdatedFlag = searchParams.get('historyUpdated') === '1';
  const historyDeletedFlag = searchParams.get('historyDeleted') === '1';

  const historiesNewestFirst = [...testSet.histories].sort((a, b) =>
    String(b.date).localeCompare(String(a.date))
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          ← {t(locale, 'backToSchedule')}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{t(locale, 'editSchedule')}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {testSet.item.name} · {testSet.user.name}
      </p>

      {savedFlag ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{t(locale, 'scheduleUpdated')}</p>
      ) : null}
      {addedFlag ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{t(locale, 'visitAdded')}</p>
      ) : null}
      {historyUpdatedFlag ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{t(locale, 'historyUpdated')}</p>
      ) : null}
      {historyDeletedFlag ? (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{t(locale, 'historyDeleted')}</p>
      ) : null}

      {actionData && 'error' in actionData && actionData.error ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{actionData.error}</p>
      ) : null}

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t(locale, 'scheduleDetails')}</h2>
        {testSet.lastReminderAt ? (
          <p className="mt-2 text-xs text-gray-500">
            {t(locale, 'lastReminder')}: {new Date(testSet.lastReminderAt).toLocaleDateString()}
          </p>
        ) : null}
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="_action" value="update" />
          <input type="hidden" name="userId" value={testSet.userId} />

          <div>
            <label htmlFor="itemId" className="block text-sm font-medium text-gray-700">
              {t(locale, 'testItem')}
            </label>
            <select
              id="itemId"
              name="itemId"
              required
              defaultValue={testSet.itemId}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (default {item.defaultFrequency} d)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">
              {t(locale, 'frequencyInput')}
            </label>
            <input
              id="frequency"
              name="frequency"
              type="number"
              min={1}
              required
              defaultValue={testSet.frequency}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="nextDate" className="block text-sm font-medium text-gray-700">
              {t(locale, 'nextCheckup')}
            </label>
            <input
              id="nextDate"
              name="nextDate"
              type="date"
              required
              defaultValue={toDateInput(testSet.nextDate)}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="reminderLeadDays" className="block text-sm font-medium text-gray-700">
              {t(locale, 'reminderLeadInput')}
            </label>
            <input
              id="reminderLeadDays"
              name="reminderLeadDays"
              type="number"
              min={1}
              required
              defaultValue={testSet.reminderLeadDays}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-60"
            >
              {t(locale, 'saveSchedule')}
            </button>
          </div>
        </Form>
      </section>

      <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{t(locale, 'addVisit')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t(locale, 'addVisitHint')}</p>
        <Form method="post" className="mt-4 space-y-4">
          <input type="hidden" name="_action" value="addHistory" />
          <input type="hidden" name="historyUserId" value={testSet.userId} />

          <div>
            <label htmlFor="visitDate" className="block text-sm font-medium text-gray-700">
              {t(locale, 'visitDate')}
            </label>
            <input
              id="visitDate"
              name="visitDate"
              type="date"
              required
              defaultValue={toDateInput(new Date().toISOString())}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="clinic" className="block text-sm font-medium text-gray-700">
              {t(locale, 'clinicLabel')}
            </label>
            <input
              id="clinic"
              name="clinic"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="result" className="block text-sm font-medium text-gray-700">
              {t(locale, 'resultLabel')}
            </label>
            <textarea
              id="result"
              name="result"
              required
              rows={5}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {t(locale, 'submitVisit')}
            </button>
          </div>
        </Form>
      </section>

      {testSet.histories.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">{t(locale, 'history')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t(locale, 'editHistoryHint')}</p>
          <ul className="mt-5 space-y-3">
            {historiesNewestFirst.map((h) => (
              <li key={h.id}>
                <details className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm open:border-indigo-200 open:ring-2 open:ring-indigo-100 hover:border-gray-300">
                  <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-b from-slate-50/90 to-white px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-base font-semibold tracking-tight text-gray-900">
                        {formatVisitHeading(h.date)}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-gray-600">{h.clinic || '—'}</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap line-clamp-4 group-open:hidden">
                        {h.result.trim() ? h.result : '—'}
                      </p>
                      <p className="mt-2 text-xs font-medium text-indigo-600 group-open:hidden">
                        {t(locale, 'openToEditVisit')}
                      </p>
                    </div>
                  </summary>

                  <div className="p-4 sm:p-5">
                    <Form method="post" id={`history-update-${h.id}`} className="space-y-4">
                      <input type="hidden" name="_action" value="updateHistory" />
                      <input type="hidden" name="historyId" value={h.id} />
                      <input type="hidden" name="historyUserId" value={h.userId} />

                      <div className="grid gap-4 sm:grid-cols-12">
                        <div className="sm:col-span-4">
                          <label
                            className="block text-sm font-medium text-gray-700"
                            htmlFor={`edit-visit-date-${h.id}`}
                          >
                            {t(locale, 'visitDate')}
                          </label>
                          <input
                            id={`edit-visit-date-${h.id}`}
                            name="editVisitDate"
                            type="date"
                            required
                            defaultValue={toDateInput(h.date)}
                            className="mt-1 block w-full rounded-md border border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="sm:col-span-8">
                          <label
                            className="block text-sm font-medium text-gray-700"
                            htmlFor={`edit-clinic-${h.id}`}
                          >
                            {t(locale, 'clinicLabel')}
                          </label>
                          <input
                            id={`edit-clinic-${h.id}`}
                            name="editClinic"
                            type="text"
                            required
                            defaultValue={h.clinic}
                            autoComplete="organization"
                            className="mt-1 block w-full rounded-md border border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium text-gray-700"
                          htmlFor={`edit-result-${h.id}`}
                        >
                          {t(locale, 'resultLabel')}
                        </label>
                        <textarea
                          id={`edit-result-${h.id}`}
                          name="editResult"
                          required
                          rows={5}
                          defaultValue={h.result}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </Form>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          className="text-sm font-medium text-gray-600 hover:text-gray-900"
                          onClick={(e) => {
                            const root = e.currentTarget.closest('details');
                            root?.removeAttribute('open');
                          }}
                        >
                          {t(locale, 'cancelEditingVisit')}
                        </button>
                        <Form
                          method="post"
                          className="inline"
                          onSubmit={(e) => {
                            if (!confirm(t(locale, 'confirmDeleteVisit'))) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="_action" value="deleteHistory" />
                          <input type="hidden" name="historyId" value={h.id} />
                          <button
                            type="submit"
                            disabled={busy}
                            className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {t(locale, 'deleteVisit')}
                          </button>
                        </Form>
                      </div>
                      <button
                        type="submit"
                        form={`history-update-${h.id}`}
                        disabled={busy}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60"
                      >
                        {t(locale, 'saveVisitChanges')}
                      </button>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
