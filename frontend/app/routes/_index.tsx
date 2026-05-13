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
  frequency: number;
  nextDate: string;
  reminderLeadDays: number;
  lastReminderAt: string | null;
  user: User;
  item: Item;
  histories: History[];
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
        frequency
        nextDate
        reminderLeadDays
        lastReminderAt
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
          {getAllTestSets.map((testSet) => (
            <div key={testSet.id} className="p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
                    {testSet.item.name}
                  </p>
                  <h2 className="text-lg font-medium text-gray-900">
                    {t(locale, 'nextCheckup')}: {new Date(testSet.nextDate).toLocaleDateString()}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t(locale, 'frequencyDays', { days: testSet.frequency })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t(locale, 'reminderLead', { days: testSet.reminderLeadDays })}
                  </p>
                  {testSet.lastReminderAt ? (
                    <p className="text-xs text-gray-400">
                      {t(locale, 'lastReminder')}: {new Date(testSet.lastReminderAt).toLocaleDateString()}
                    </p>
                  ) : null}
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
                </div>
              </div>

              {testSet.histories.length > 0 ? (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-900">{t(locale, 'history')}</h3>
                  <div className="rounded-md bg-gray-50">
                    <ul className="divide-y divide-gray-200">
                      {testSet.histories.map((history) => (
                        <li key={history.id} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(history.date).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-gray-500">{history.clinic}</p>
                            </div>
                            <div className="text-sm">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  history.result === 'Normal'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {history.result}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t(locale, 'noHistory')}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
