import type { InteractivityProps } from '@threlte/extras';

declare global {
	namespace App {
		interface Error {
			stack?: string;
		}
	}

	namespace Threlte {
		interface UserProps extends InteractivityProps {}
	}
}
