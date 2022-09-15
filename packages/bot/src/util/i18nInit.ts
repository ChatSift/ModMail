import { fileURLToPath, URL } from 'node:url';
import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';

export async function i18nInit() {
	return i18next.use(FsBackend).init({
		backend: {
			loadPath: fileURLToPath(new URL('../../locales/{{lng}}/{{ns}}.json', import.meta.url)),
		},
		cleanCode: true,
		fallbackLng: ['en-US'],
		defaultNS: 'translation',
		lng: 'en-US',
		ns: ['translation'],
	});
}
