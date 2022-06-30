import { join } from 'node:path';
import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';

export function i18nInit() {
	return i18next.use(FsBackend).init({
		backend: {
			loadPath: join(process.cwd(), 'locales', '{{lng}}', '{{ns}}.json'),
		},
		cleanCode: true,
		fallbackLng: ['en-US'],
		defaultNS: 'translation',
		lng: 'en-US',
		ns: ['translation'],
	});
}
