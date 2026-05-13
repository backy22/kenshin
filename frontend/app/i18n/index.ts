import { en, type MessageKey } from './messages/en';
import { ja } from './messages/ja';

export type Locale = 'en' | 'ja';

const bundles: Record<Locale, Record<MessageKey, string>> = { en, ja };

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let s = bundles[locale][key] ?? bundles.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{{${k}}}`, String(v));
    }
  }
  return s;
}

export { type MessageKey };
