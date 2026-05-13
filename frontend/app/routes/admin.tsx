import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { gqlRequest } from '../lib/graphql-client';
import { readAuthToken, SESSION_ROLE, getSession } from '../session.server';
import { t, type Locale } from '../i18n';

function getLocale(request: Request): Locale {
  const c = request.headers.get('Cookie') ?? '';
  return c.includes('kenshin_lang=ja') ? 'ja' : 'en';
}

export const meta: MetaFunction = () => [{ title: 'Admin | Kenshin' }];

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = getLocale(request);
  const token = await readAuthToken(request);
  if (!token) throw redirect('/login');
  const session = await getSession(request.headers.get('Cookie'));
  if (session.get(SESSION_ROLE) !== 'ADMIN') throw redirect('/');

  const query = `
    query {
      getAllUsers { id name email birthday gender role }
      getAllItems { id name nameKey defaultFrequency whereGuidanceEn }
      screeningRules { id itemId minAge maxAge appliesGender intervalDays priority }
    }
  `;
  const data = await gqlRequest<{
    getAllUsers: Array<{
      id: number;
      name: string;
      email: string;
      birthday: string;
      gender: string;
      role: string;
    }>;
    getAllItems: Array<{
      id: number;
      name: string;
      nameKey: string;
      defaultFrequency: number;
      whereGuidanceEn: string | null;
    }>;
    screeningRules: Array<{
      id: number;
      itemId: number;
      minAge: number | null;
      maxAge: number | null;
      appliesGender: string;
      intervalDays: number;
      priority: number;
    }>;
  }>(query, undefined, token);

  return json({ ...data, locale });
}

export default function AdminRoute() {
  const { getAllUsers, getAllItems, screeningRules, locale } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">{t(locale, 'adminTitle')}</h1>

      <section>
        <h2 className="text-lg font-semibold text-gray-800">{t(locale, 'adminUsers')}</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Email</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {getAllUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.id}</td>
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800">{t(locale, 'adminItems')}</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Key</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Default (days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {getAllItems.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2">{i.id}</td>
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{i.nameKey}</td>
                  <td className="px-3 py-2">{i.defaultFrequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800">Screening rules</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Item</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Age</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Gender</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Days</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Pri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {screeningRules.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2">{r.itemId}</td>
                  <td className="px-3 py-2">
                    {r.minAge ?? '—'}–{r.maxAge ?? '—'}
                  </td>
                  <td className="px-3 py-2">{r.appliesGender}</td>
                  <td className="px-3 py-2">{r.intervalDays}</td>
                  <td className="px-3 py-2">{r.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
