type Brand<T, B extends string> = T & { readonly __brand: B };

export type CityId = Brand<string, 'CityId'>;
export type RegionId = Brand<string, 'RegionId'>;
export type SeatId = Brand<string, 'SeatId'>;
export type CharacterId = Brand<string, 'CharacterId'>;
export type CardId = Brand<string, 'CardId'>;
export type BundleId = Brand<string, 'BundleId'>;

export const edgeKey = (a: CityId, b: CityId): string => (a < b ? `${a}~${b}` : `${b}~${a}`);
