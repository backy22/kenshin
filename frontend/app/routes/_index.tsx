import type { LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Link, useLoaderData, useOutletContext } from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';
import { readAuthToken } from '../session.server';
import { t, type Locale } from '../i18n';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface History {
  id: number;
  date: string;
  clinic: string;
  result: string;
}

interface Item {
  id: number;
  name: string;
  nameKey: string;
  whereGuidanceEn: string | null;
  defaultFrequency: number;
}

interface TestSet {
  id: number;
  nextDate: string;
  reminderLeadDays: number;
  user: User;
  item: Item;
  histories: History[];
}

/** Local calendar day at midnight (avoids UTC shift on YYYY-MM-DD strings). */
function parseLocalDateOnly(iso: string): Date {
  const part = iso.split('T')[0] ?? iso;
  const [y, m, d] = part.split('-').map(Number);
  if (!y || !m || !d) return new Date(iso);
  return new Date(y, m - 1, d);
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Matches api/reminders_job.py: window_start <= today <= next_date. */
function scheduleAttention(nextDateIso: string, reminderLeadDays: number): 'none' | 'reminder' | 'overdue' {
  const next = startOfLocalDay(parseLocalDateOnly(nextDateIso));
  const today = startOfLocalDay(new Date());
  if (today > next) return 'overdue';
  const lead = Math.max(0, reminderLeadDays);
  const windowStart = new Date(next);
  windowStart.setDate(windowStart.getDate() - lead);
  if (windowStart <= today && today <= next) return 'reminder';
  return 'none';
}

interface ReminderRow {
  id: number;
  nextDate: string;
  reminderLeadDays: number;
  item: { name: string };
}

interface LoaderData {
  getAllTestSets: TestSet[];
  upcomingReminders: ReminderRow[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');

  const query = `
    query {
      getAllTestSets {
        id
        nextDate
        reminderLeadDays
        user {
          id
          name
          email
          role
        }
        item {
          id
          name
          nameKey
          whereGuidanceEn
          defaultFrequency
        }
        histories {
          id
          date
          clinic
          result
        }
      }
      upcomingReminders(withinDays: 90) {
        id
        nextDate
        reminderLeadDays
        item {
          name
        }
      }
    }
  `;

  try {
    const data = await gqlRequest<LoaderData>(query, undefined, token);
    return json(data);
  } catch (error) {
    console.error('Error fetching test sets:', error);
    return json({ getAllTestSets: [], upcomingReminders: [] });
  }
}

export default function Index() {
  const outlet = useOutletContext<{ locale?: Locale } | undefined>();
  const locale = outlet?.locale ?? 'en';
  const { getAllTestSets, upcomingReminders } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t(locale, 'disclaimerShort')}
        </p>

        <div className="mb-10 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-indigo-900">{t(locale, 'upcomingReminders')}</h2>
          {upcomingReminders.length === 0 ? (
            <p className="mt-2 text-sm text-indigo-800">{t(locale, 'noReminders')}</p>
          ) : (
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-indigo-900">
              {upcomingReminders.map((r) => (
                <li key={r.id}>
                  {r.item.name} — {t(locale, 'dueBy')}{' '}
                  {new Date(r.nextDate).toLocaleDateString()} ({t(locale, 'reminderLead', { days: r.reminderLeadDays })})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900">{t(locale, 'scheduleTitle')}</h1>
          <Link
            to="/test-sets/new"
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {t(locale, 'navNewCheckup')}
          </Link>
        </div>
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
          {getAllTestSets.map((testSet) => {
            const attention = scheduleAttention(testSet.nextDate, testSet.reminderLeadDays);
            const cardClass =
              attention === 'reminder'
                ? 'border-l-4 border-l-amber-400 bg-amber-50/50 pl-5'
                : attention === 'overdue'
                  ? 'border-l-4 border-l-rose-500 bg-rose-50/50 pl-5'
                  : '';
            return (
            <div key={testSet.id} className={`p-6 ${cardClass}`.trim()}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
                      {testSet.item.name}
                    </p>
                    {attention === 'reminder' ? (
                      <span className="inline-flex items-center rounded-full bg-amber-200/80 px-2 py-0.5 text-xs font-semibold text-amber-950">
                        {t(locale, 'scheduleBadgeReminder')}
                      </span>
                    ) : attention === 'overdue' ? (
                      <span className="inline-flex items-center rounded-full bg-rose-200/80 px-2 py-0.5 text-xs font-semibold text-rose-950">
                        {t(locale, 'scheduleBadgeOverdue')}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-lg font-medium text-gray-900">
                    {t(locale, 'nextCheckup')}: {new Date(testSet.nextDate).toLocaleDateString()}
                  </h2>
                  {testSet.item.whereGuidanceEn ? (
                    <p className="mt-2 max-w-2xl text-sm text-gray-600">
                      <span className="font-medium text-gray-700">{t(locale, 'whereTypical')}: </span>
                      {testSet.item.whereGuidanceEn}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-gray-900">{testSet.user.name}</p>
                  <p className="text-gray-500">{testSet.user.email}</p>
                  <Link
                    to={`/test-sets/${testSet.id}`}
                    className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {t(locale, 'editCard')}
                  </Link>
                </div>
              </div>

              {testSet.histories.length > 0 ? (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-900">{t(locale, 'history')}</h3>
                  <div className="rounded-md bg-gray-50">
                    <ul className="divide-y divide-gray-200">
                      {testSet.histories.map((history) => (
                        <li key={history.id} className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(history.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-500">{history.clinic}</p>
                          <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">
                            {history.result}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t(locale, 'noHistory')}</p>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
