import type { FeedbackEngine } from '@stefan.inc/feedback-engine/svelte';
import { LS } from '#lib/storage.ts';

let engine: Promise<FeedbackEngine> | undefined;
let filedWith: string | undefined;

/**
 * Where the editor files ProcrastiMate tasks. The dev server's own proxy is wired in by `feedbackProcrastimate()`. The
 * deployed Worker's (`apps/signal`) files only for someone who knows the players' passphrase, which leads its path.
 */
function procrastimate(passphrase: string) {
	if (import.meta.env.DEV || !passphrase) return undefined;
	return {
		url: `/__feedback/procrastimate/${encodeURIComponent(passphrase)}`,
		projects: ['a/bg-pandemic-2'],
	};
}

/**
 * Alt+Meta+click anything to open the feedback editor on it, in every build. The import is dynamic, so the editor
 * loads after the page and never delays the first frame.
 */
export function startFeedback(): () => void {
	const passphrase = LS.get('passphrase', '');
	filedWith = passphrase;
	const started = import('@stefan.inc/feedback-engine/svelte').then(({ setupFeedbackEngine }) => {
		const feedback = setupFeedbackEngine({
			app: 'Pandemic Legacy S2',
			pinned: ['ProcrastiMate'],
			procrastimate: procrastimate(passphrase),
		});
		feedback.context('Connection', () => window.DEBUG?.connection() ?? null);
		feedback.context('Game', () => {
			const state = window.DEBUG?.getState();
			if (!state) return null;
			const { campaign, game } = state.world;
			return {
				phase: state.phase,
				month: campaign.month,
				attempt: campaign.attempt,
				turn: game?.turn,
				active: game?.active,
				actionsLeft: game?.actionsLeft,
				epidemics: game?.epidemics,
				incidents: game?.incidents,
				pending: game?.pending.map(decision => decision.t),
			};
		});
		return feedback;
	});
	engine = started;
	return () => {
		if (engine === started) engine = undefined;
		void started.then(feedback => feedback.destroy());
	};
}

/** Starts the editor again once the passphrase it files ProcrastiMate tasks with has changed. */
export function passphraseChanged() {
	if (engine && LS.get('passphrase', '') !== filedWith) startFeedback();
}

export async function presentFeedback() {
	if (!engine) throw new Error('Feedback is not started: startFeedback() runs from the root layout');
	await (await engine).present();
}
