import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { feedbackEngine, feedbackProcrastimate } from '@stefan.inc/feedback-engine/vite';
import env from '../../packages/shared/src/env.ts';
import { defineConfig } from 'vite';

const uiHost = new URL(env.UI_URL).hostname;

export default defineConfig({
	plugins: [
		tailwindcss(),
		feedbackProcrastimate({ token: env.PROCRASTIMATE_TOKEN, project: 'a/bg-pandemic-2' }),
		sveltekit({
			preprocess: [feedbackEngine()],
			adapter: adapter({
				fallback: 'index.html',
			}),
			compilerOptions: {
				warningFilter: warning => !warning.code.startsWith('a11y_'),
			},
		}),
	],
	define: {
		__SIGNAL_URL__: JSON.stringify(env.SIGNAL_URL),
	},
	clearScreen: false,
	optimizeDeps: {
		exclude: ['@tanstack/svelte-query'],
	},
	server: {
		watch: { ignored: ['**/build/**'] },
		allowedHosts: [uiHost],
		port: env.UI_PORT,
		strictPort: true,
		proxy: {
			'/api': {
				target: env.SERVER_URL,
				changeOrigin: true,
				secure: false,
			},
		},
	},
});
