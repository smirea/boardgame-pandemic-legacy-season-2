type Brand<T, B extends string> = T & { readonly __brand: B };

export type CityId = Brand<string, 'CityId'>;
export type RegionId = Brand<string, 'RegionId'>;
export type RouteId = Brand<string, 'RouteId'>;
export type SeatId = Brand<string, 'SeatId'>;
export type CharacterId = Brand<string, 'CharacterId'>;
export type CardId = Brand<string, 'CardId'>;

export const routeId = (a: CityId, b: CityId): RouteId => (a < b ? `${a}~${b}` : `${b}~${a}`) as RouteId;
