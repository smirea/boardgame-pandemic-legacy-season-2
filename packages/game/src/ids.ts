type Brand<T, B extends string> = T & { readonly __brand: B };

export type CityId = Brand<string, "CityId">;
export type RegionId = Brand<string, "RegionId">;
/** Ocean the printed board leaves dark, which owns ground in the partition but is no location. */
export type UnchartedId = Brand<string, "UnchartedId">;
/** Whatever owns a piece of the board's ground: a location or uncharted ground. */
export type GroundId = CityId | UnchartedId;
export type SeatId = Brand<string, "SeatId">;
/** A person at the table: the id their browser keeps across reloads. */
export type PlayerId = Brand<string, "PlayerId">;
export type CharacterId = Brand<string, "CharacterId">;
export type CardId = Brand<string, "CardId">;

export const edgeKey = (a: CityId, b: CityId): string => (a < b ? `${a}~${b}` : `${b}~${a}`);
