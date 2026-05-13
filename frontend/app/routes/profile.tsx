import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';
import { readAuthToken, SESSION_USER_ID, getSession } from '../session.server';
import { t, type Locale } from '../i18n';

function getLocale(request: Request): Locale {
  const c = request.headers.get('Cookie') ?? '';
  return c.includes('kenshin_lang=ja') ? 'ja' : 'en';
}

export const meta: MetaFunction = () => [{ title: 'Profile | Kenshin' }];

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = getLocale(request);
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');
  const data = await gqlRequest<{
    me: { id: number; name: string; email: string; birthday: string; gender: string; role: string } | null;
  }>(
    `query { me { id name email birthday gender role } }`,
    undefined,
    token
  );
  if (!data.me) throw redirect('/login');
  return json({ me: data.me, locale });
}

export async function action({ request }: ActionFunctionArgs) {
  const locale = getLocale(request);
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');
  const session = await getSession(request.headers.get('Cookie'));
  const userId = Number(session.get(SESSION_USER_ID));
  const form = await request.formData();
  const mutation = `
    mutation UpdateUser($userId: Int!, $userData: UserInput!) {
      updateUser(userId: $userId, userData: $userData)
    }
  `;
  await gqlRequest(
    mutation,
    {
      userId,
      userData: {
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        birthday: String(form.get('birthday') ?? ''),
        gender: String(form.get('gender') ?? 'OTHER'),
      },
    },
    token
  );
  return json({ ok: true, locale });
}

export default function ProfileRoute() {
  const { me, locale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">{t(locale, 'profileTitle')}</h1>
      {actionData && 'ok' in actionData && actionData.ok ? (
        <p className="mt-2 text-sm text-green-700">Saved.</p>
      ) : null}
      <Form method="post" className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="name">
            {t(locale, 'displayName')}
          </label>
          <input
            id="name"
            name="name"
            defaultValue={me.name}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="email">
            {t(locale, 'email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={me.email}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="birthday">
            {t(locale, 'birthday')}
          </label>
          <input
            id="birthday"
            name="birthday"
            type="date"
            defaultValue={me.birthday}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="gender">
            {t(locale, 'gender')}
          </label>
          <select
            id="gender"
            name="gender"
            defaultValue={me.gender}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="FEMALE">FEMALE</option>
            <option value="MALE">MALE</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
        >
          {t(locale, 'saveProfile')}
        </button>
      </Form>
    </div>
  );
}
