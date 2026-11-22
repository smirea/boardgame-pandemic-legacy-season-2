import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { feedbackEngine, feedbackProcrastimate } from '@stefan.inc/feedback-engine/vite';
import env from '../../packages/shared/src/env.ts';
import { defineConfig } from 'vite';

const uiHost = new URL(env.UI_URL).hostname;

export default defineConfig(({ command }) => ({
	plugins: [
		tailwindcss(),
		// Only the dev server forwards to ProcrastiMate. A built site has no proxy, so it must not offer the entry.
		feedbackProcrastimate({
			token: command === 'serve' ? env.PROCRASTIMATE_TOKEN : undefined,
			project: 'a/bg-pandemic-2',
			projects: ['a/bg-pandemic-2'],
		}),
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
		// The dev server passes `/signal` to its own Worker, so a browser on another machine reaches it through the page's host.
		__SIGNAL_URL__: JSON.stringify(command === 'serve' ? '/signal' : env.SIGNAL_URL),
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
			'/signal': {
				target: `http://127.0.0.1:${env.DEV_SIGNAL_PORT}`,
				ws: true,
				rewrite: path => path.replace(/^\/signal\/?/, '/'),
			},
		},
	},
}));
