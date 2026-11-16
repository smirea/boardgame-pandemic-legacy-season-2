/**
 * Alt+Meta+click anything to open the feedback editor on it. Development builds only: the import is dynamic,
 * so a production bundle carries none of the editor.
 */
export async function startFeedback(): Promise<() => void> {
	const { setupFeedbackEngine } = await import('@stefan.inc/feedback-engine/svelte');
	const engine = setupFeedbackEngine({ app: 'Pandemic Legacy S2', pinned: ['ProcrastiMate'] });
	engine.context('Connection', () => window.DEBUG?.connection() ?? null);
	engine.context('Game', () => {
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
	return engine.destroy;
}
