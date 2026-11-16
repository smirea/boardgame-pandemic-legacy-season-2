import type { FeedbackEngine } from '@stefan.inc/feedback-engine/svelte';

let engine: Promise<FeedbackEngine> | undefined;

/**
 * Alt+Meta+click anything to open the feedback editor on it. Development builds only: the import is dynamic,
 * so a production bundle carries none of the editor.
 */
export function startFeedback(): () => void {
	// Read here rather than at the call site, so the production build drops the dynamic import with this branch.
	if (!import.meta.env.DEV) return () => {};
	const started = import('@stefan.inc/feedback-engine/svelte').then(({ setupFeedbackEngine }) => {
		const feedback = setupFeedbackEngine({ app: 'Pandemic Legacy S2', pinned: ['ProcrastiMate'] });
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

export async function presentFeedback() {
	if (!engine) throw new Error('Feedback is not started: startFeedback() runs from the root layout in development');
	await (await engine).present();
}
