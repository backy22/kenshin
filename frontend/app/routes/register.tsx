import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react';
import {
  commitSession,
  getSession,
  readAuthToken,
  SESSION_NAME,
  SESSION_ROLE,
  SESSION_TOKEN,
  SESSION_USER_ID,
} from '../session.server';
import { t, type Locale } from '../i18n';

const apiUrl = () => process.env.API_URL || 'http://localhost:8000';

function getLocale(request: Request): Locale {
  const c = request.headers.get('Cookie') ?? '';
  return c.includes('kenshin_lang=ja') ? 'ja' : 'en';
}

export const meta: MetaFunction = () => [{ title: 'Register | Kenshin' }];

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = getLocale(request);
  const token = await readAuthToken(request);
  if (token) throw redirect('/');
  return json({ locale });
}

export async function action({ request }: ActionFunctionArgs) {
  const locale = getLocale(request);
  const form = await request.formData();
  const body = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
    birthday: String(form.get('birthday') ?? ''),
    gender: String(form.get('gender') ?? 'OTHER'),
  };
  const res = await fetch(`${apiUrl()}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return json(
      { error: (err as { detail?: string }).detail || 'Registration failed', locale },
      { status: 400 }
    );
  }
  const data = (await res.json()) as {
    access_token: string;
    user_id: number;
    role: string;
    name: string;
  };
  const session = await getSession(request.headers.get('Cookie'));
  session.set(SESSION_TOKEN, data.access_token);
  session.set(SESSION_USER_ID, String(data.user_id));
  session.set(SESSION_ROLE, data.role);
  session.set(SESSION_NAME, data.name);
  return redirect('/', {
    headers: { 'Set-Cookie': await commitSession(session) },
  });
}

export default function RegisterRoute() {
  const { locale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">{t(locale, 'registerTitle')}</h1>
      {actionData && 'error' in actionData && actionData.error ? (
        <p className="mt-2 text-sm text-red-600">{actionData.error}</p>
      ) : null}
      <Form method="post" className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="name">
            {t(locale, 'displayName')}
          </label>
          <input
            id="name"
            name="name"
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
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="password">
            {t(locale, 'password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
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
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
        >
          {t(locale, 'submitRegister')}
        </button>
      </Form>
      <p className="mt-4 text-center text-sm text-gray-600">
        <Link to="/login" className="text-indigo-600 hover:text-indigo-800">
          {t(locale, 'navLogin')}
        </Link>
      </p>
    </div>
  );
}
