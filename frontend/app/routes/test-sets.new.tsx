import { useEffect, useState } from 'react';
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

export async function loader({ request }: LoaderFunctionArgs) {
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');

  const url = new URL(request.url);
  const itemPreview = url.searchParams.get('itemPreview');

  const baseQuery = `
    query {
      me { id role name email }
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
    const sid = await gqlRequest<{ suggestScreeningInterval: number }>(
      `query ($userId: Int!, $itemId: Int!) {
        suggestScreeningInterval(userId: $userId, itemId: $itemId)
      }`,
      { userId: data.me.id, itemId: Number(itemPreview) },
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
  const fetcher = useFetcher<typeof loader>();
  const [selectedItem, setSelectedItem] = useState(itemPreview ?? '');

  useEffect(() => {
    if (!selectedItem) return;
    fetcher.load(`/test-sets/new?itemPreview=${encodeURIComponent(selectedItem)}`);
    // fetcher is stable; only re-fetch when the selected catalog item changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem]);

  if (!me) {
    return null;
  }

  const suggested = fetcher.data?.suggestedDays ?? suggestedDays;
  const isSubmitting = navigation.state === 'submitting';

  const defaultUserId = me.role === 'ADMIN' ? '' : String(me.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">{t(locale, 'navNewCheckup')}</h1>

      {actionData?.error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {actionData.error}
        </div>
      ) : null}

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Form method="post" className="space-y-6">
          {me.role === 'ADMIN' ? (
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                User
              </label>
              <select
                id="userId"
                name="userId"
                required
                defaultValue={defaultUserId}
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
              Test item
            </label>
            <select
              id="itemId"
              name="itemId"
              required
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            >
              <option value="">Select a test item</option>
              {getAllItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (default {item.defaultFrequency} days)
                </option>
              ))}
            </select>
            {suggested != null && selectedItem ? (
              <p className="mt-2 text-sm text-indigo-700">
                Guideline suggestion for your profile: every <strong>{suggested}</strong> days (you can
                override below).
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">
              Frequency (days)
            </label>
            <input
              type="number"
              id="frequency"
              name="frequency"
              required
              min={1}
              key={`${selectedItem}-${suggested ?? 'x'}`}
              defaultValue={suggested ?? getAllItems.find((i) => String(i.id) === selectedItem)?.defaultFrequency ?? ''}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="nextDate" className="block text-sm font-medium text-gray-700">
              Next checkup date
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
              Reminder lead (days before due date)
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
