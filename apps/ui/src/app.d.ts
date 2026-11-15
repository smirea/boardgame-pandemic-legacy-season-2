import type { InteractivityProps } from '@threlte/extras';

declare global {
	namespace App {}

	namespace Threlte {
		interface UserProps extends InteractivityProps {}
	}
}
