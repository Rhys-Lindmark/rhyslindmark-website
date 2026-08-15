// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://www.rhyslindmark.com',
	integrations: [sitemap()],
	redirects: {
		'/about-me': '/',
		'/reversejd': '/work-with-me',
	},
});
