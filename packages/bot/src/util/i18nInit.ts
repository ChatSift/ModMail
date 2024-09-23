import i18next, { type ParseKeys } from 'i18next';
import type { TOptions } from 'i18next';
import FsBackend from 'i18next-fs-backend';
import { enUS } from '../locales/en-US/translation.js';

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'translation';
		resources: {
			translation: typeof enUS;
		};
	}
}

export type TranslationKey = ParseKeys<'translation', TOptions>;

export async function i18nInit() {
	return i18next.use(FsBackend).init({
		// backend: { loadPath: fileURLToPath(new URL('../../locales/{{lng}}/{{ns}}.json', import.meta.url)) },
		resources: {
			en: {
				translation: enUS,
			},
		},
		cleanCode: true,
		fallbackLng: ['en-US'],
		defaultNS: 'translation',
		lng: 'en-US',
		ns: ['translation'],
	});
}
