import { expect, test } from "bun:test";
import { RULE_STICKERS } from "./content/rulebook";
import type { StickerSlot } from "./content/rulebook";
import { sealKey } from "./content/types";
import { rulebook } from "./dossier";
import type { RulebookChapter } from "./dossier";
import { newCampaign } from "./legacy";

const blocks = (book: RulebookChapter[]) =>
  book.flatMap((chapter) => chapter.sections.flatMap((section) => section.blocks));
const placed = (book: RulebookChapter[]) =>
  new Set(
    blocks(book).flatMap((block) => (block.t !== "slot" && block.sticker ? [block.sticker] : [])),
  );
const empty = (book: RulebookChapter[]) =>
  new Set(blocks(book).flatMap((block) => (block.t === "slot" ? [block.sticker] : [])));
const SLOTS = Object.keys(RULE_STICKERS) as StickerSlot[];

test("a rule sticker is in the rulebook only once the package or door that holds it is open", () => {
  const campaign = newCampaign(1);
  expect(placed(rulebook(campaign)).size).toBe(0);
  expect(empty(rulebook(campaign))).toEqual(new Set(SLOTS));

  campaign.opened.push(sealKey(RULE_STICKERS.D));
  const book = rulebook(campaign);
  expect([...placed(book)]).toEqual(["D"]);
  expect(empty(book).has("D")).toBe(false);
});

test("a placed rule sticker takes out the printed rule it replaces", () => {
  const campaign = newCampaign(1);
  const setupInfection = () =>
    rulebook(campaign)
      .flatMap((chapter) => chapter.sections)
      .find((section) => section.id === "setup-4")!.blocks;
  expect(setupInfection()).toHaveLength(2);
  campaign.opened.push(sealKey(RULE_STICKERS.D));
  expect(setupInfection()).toEqual([expect.objectContaining({ sticker: "D" })]);
});
