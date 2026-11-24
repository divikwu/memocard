import { pinyin } from "pinyin-pro";

function normalizePinyinSearch(value: string) {
  return value.normalize("NFKC").toLowerCase().replaceAll("ü", "v").replace(/[\s/]+/g, "");
}

export function tagSearchKeys(name: string) {
  const original = name.toLocaleLowerCase();
  const normalized = name.normalize("NFKC");
  if (!/\p{Script=Han}/u.test(normalized)) return {original, sortKey: normalized, full: "", initials: ""};

  const segments = normalized.split("/").map(segment => pinyin(segment, {toneType: "none", type: "all", nonZh: "consecutive"}));
  const sortKey = segments.map(segment => segment.map(syllable => syllable.result).join("")).join("/");
  const initials = segments.flatMap(segment => segment.map(syllable => syllable.first)).join("");
  return {original, sortKey, full: normalizePinyinSearch(sortKey), initials: normalizePinyinSearch(initials)};
}

export function tagSearchRank(query: string) {
  const needle = query.trim().toLocaleLowerCase();
  const pinyinNeedle = normalizePinyinSearch(query);
  return ({original, full, initials}: ReturnType<typeof tagSearchKeys>) => {
    if (original === needle) return 0;
    if (pinyinNeedle && (full === pinyinNeedle || initials === pinyinNeedle)) return 1;
    if (original.includes(needle) || pinyinNeedle && (full.includes(pinyinNeedle) || initials.includes(pinyinNeedle))) return 2;
    return -1;
  };
}
