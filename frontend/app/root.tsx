import { cssBundleHref } from '@remix-run/css-bundle';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, Link, useLoaderData } from '@remix-run/react';
import { gqlRequest } from './lib/graphql-client';
import { readAuthToken } from './session.server';
import type { Locale } from './i18n';
import { t } from './i18n';
import tailwindHref from './styles/tailwind.css?url';

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
  { rel: 'stylesheet', href: tailwindHref },
];

function getLocale(request: Request): Locale {
  const c = request.headers.get('Cookie') ?? '';
  return c.includes('kenshin_lang=ja') ? 'ja' : 'en';
}

export async function loader({ request }: LoaderFunctionArgs) {
  const locale = getLocale(request);
  const token = await readAuthToken(request);
  let user: { name: string; role: string } | null = null;
  if (token) {
    try {
      const data = await gqlRequest<{ me: { name: string; role: string } | null }>(
        `query { me { name role } }`,
        undefined,
        token
      );
      user = data.me;
    } catch {
      user = null;
    }
  }
  return json({ locale, user });
}

export default function App() {
  const { locale, user } = useLoaderData<typeof loader>();

  return (
    <html lang={locale} className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-gray-50 text-gray-900">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <Link to="/" className="text-lg font-semibold text-indigo-700">
              {t(locale, 'appTitle')}
            </Link>
            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium">
              {user ? (
                <>
                  <Link to="/" className="text-gray-700 hover:text-indigo-600">
                    {t(locale, 'navSchedule')}
                  </Link>
                  <Link to="/test-sets/new" className="text-gray-700 hover:text-indigo-600">
                    {t(locale, 'navNewCheckup')}
                  </Link>
                  <Link to="/profile" className="text-gray-700 hover:text-indigo-600">
                    {t(locale, 'navProfile')}
                  </Link>
                  {user.role === 'ADMIN' ? (
                    <Link to="/admin" className="text-gray-700 hover:text-indigo-600">
                      {t(locale, 'navAdmin')}
                    </Link>
                  ) : null}
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{user.name}</span>
                  <Link to="/logout" className="text-indigo-600 hover:text-indigo-800">
                    {t(locale, 'navLogout')}
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-700 hover:text-indigo-600">
                    {t(locale, 'navLogin')}
                  </Link>
                  <Link to="/register" className="text-gray-700 hover:text-indigo-600">
                    {t(locale, 'navRegister')}
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <Outlet context={{ locale }} />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
