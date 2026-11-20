type Brand<T, B extends string> = T & { readonly __brand: B };

export type CityId = Brand<string, 'CityId'>;
export type RegionId = Brand<string, 'RegionId'>;
export type SeatId = Brand<string, 'SeatId'>;
/** A person at the table: the id their browser keeps across reloads. */
export type PlayerId = Brand<string, 'PlayerId'>;
export type CharacterId = Brand<string, 'CharacterId'>;
export type CardId = Brand<string, 'CardId'>;

export const edgeKey = (a: CityId, b: CityId): string => (a < b ? `${a}~${b}` : `${b}~${a}`);
