import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "https://esm.sh/unique-names-generator";
import { t } from "./i18n.js";

export const getDefaultChores = () => [
  { label: t("chores.empty_trash"), color: "green" },
  { label: t("chores.clean_spices") },
  { label: t("chores.vacuum_rug"), color: "blue" },
  { label: t("chores.dust_tv") },
  { label: t("chores.wipe_remote"), color: "red" },

  { label: t("chores.shred_mail") },
  { label: t("chores.donate_coat"), color: "green" },
  { label: t("chores.clean_sink") },
  { label: t("chores.toss_cans") },
  { label: t("chores.water_plants") },

  { label: t("chores.organize_shoes") },
  { label: t("chores.clear_desk") },
  { label: t("chores.free_space"), isFree: true },
  { label: t("chores.scrub_tub") },
  { label: t("chores.mop_kitchen") },

  { label: t("chores.wipe_mirrors") },
  { label: t("chores.laundry") },
  { label: t("chores.fold_blankets") },
  { label: t("chores.clean_oven") },
  { label: t("chores.sweep_porch") },

  { label: t("chores.empty_dishwasher") },
  { label: t("chores.scrub_toilets") },
  { label: t("chores.fix_lightbulbs") },
  { label: t("chores.sanitize_handles") },
  { label: t("chores.take_out_recycling") },
];

export const iconList = [
  "🏃‍♀️",
  "🏃‍♂️",
  "🚶‍♂️",
  "🛹",
  "🚲",
  "🛵",
  "🏎️",
  "🚁",
  "🚀",
  "🛸",
  "🦄",
  "🦖",
  "🐙",
  "🐝",
  "👻",
  "🤖",
  "🧙‍♂️",
  "🧜‍♀️",
  "🐱",
  "🐶",
];

export function generateHumanReadableUniqueId() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, adjectives, animals],
    separator: "-",
    length: 4,
    style: "lowerCase",
  });
}
