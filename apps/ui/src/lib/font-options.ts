export const FONT_VALUES = [
  "geist",
  "inter",
  "noto-sans",
  "nunito-sans",
  "figtree",
  "roboto",
  "raleway",
  "dm-sans",
  "public-sans",
  "outfit",
  "oxanium",
  "manrope",
  "space-grotesk",
  "montserrat",
  "ibm-plex-sans",
  "source-sans-3",
  "instrument-sans",
  "pingfang",
  "geist-mono",
  "jetbrains-mono",
  "noto-serif",
  "roboto-slab",
  "merriweather",
  "lora",
  "playfair-display",
  "eb-garamond",
  "songti",
] as const

export type FontChoice = (typeof FONT_VALUES)[number]

type FontOption = {
  value: FontChoice
  label: string
}

type FontGroup = {
  label: "Sans" | "Mono" | "Serif"
  options: FontOption[]
}

export const FONT_GROUPS: FontGroup[] = [
  {
    label: "Sans",
    options: [
      { value: "geist", label: "Geist" },
      { value: "inter", label: "Inter" },
      { value: "noto-sans", label: "Noto Sans" },
      { value: "nunito-sans", label: "Nunito Sans" },
      { value: "figtree", label: "Figtree" },
      { value: "roboto", label: "Roboto" },
      { value: "raleway", label: "Raleway" },
      { value: "dm-sans", label: "DM Sans" },
      { value: "public-sans", label: "Public Sans" },
      { value: "outfit", label: "Outfit" },
      { value: "oxanium", label: "Oxanium" },
      { value: "manrope", label: "Manrope" },
      { value: "space-grotesk", label: "Space Grotesk" },
      { value: "montserrat", label: "Montserrat" },
      { value: "ibm-plex-sans", label: "IBM Plex Sans" },
      { value: "source-sans-3", label: "Source Sans 3" },
      { value: "instrument-sans", label: "Instrument Sans" },
      { value: "pingfang", label: "苹方" },
    ],
  },
  {
    label: "Mono",
    options: [
      { value: "geist-mono", label: "Geist Mono" },
      { value: "jetbrains-mono", label: "JetBrains Mono" },
    ],
  },
  {
    label: "Serif",
    options: [
      { value: "noto-serif", label: "Noto Serif" },
      { value: "roboto-slab", label: "Roboto Slab" },
      { value: "merriweather", label: "Merriweather" },
      { value: "lora", label: "Lora" },
      { value: "playfair-display", label: "Playfair Display" },
      { value: "eb-garamond", label: "EB Garamond" },
      { value: "songti", label: "宋体" },
    ],
  },
]

const sansFallback = '"PingFang SC", "Noto Sans SC", system-ui, sans-serif'
const monoFallback =
  '"SFMono-Regular", "SF Mono", "PingFang SC", ui-monospace, monospace'
const serifFallback = '"Songti SC", "STSong", serif'

export const FONT_FAMILIES: Record<FontChoice, string> = {
  geist: `"Geist Variable", ${sansFallback}`,
  inter: `"Inter Variable", ${sansFallback}`,
  "noto-sans": `"Noto Sans Variable", ${sansFallback}`,
  "nunito-sans": `"Nunito Sans Variable", ${sansFallback}`,
  figtree: `"Figtree Variable", ${sansFallback}`,
  roboto: `"Roboto Variable", ${sansFallback}`,
  raleway: `"Raleway Variable", ${sansFallback}`,
  "dm-sans": `"DM Sans Variable", ${sansFallback}`,
  "public-sans": `"Public Sans Variable", ${sansFallback}`,
  outfit: `"Outfit Variable", ${sansFallback}`,
  oxanium: `"Oxanium Variable", ${sansFallback}`,
  manrope: `"Manrope Variable", ${sansFallback}`,
  "space-grotesk": `"Space Grotesk Variable", ${sansFallback}`,
  montserrat: `"Montserrat Variable", ${sansFallback}`,
  "ibm-plex-sans": `"IBM Plex Sans Variable", ${sansFallback}`,
  "source-sans-3": `"Source Sans 3 Variable", ${sansFallback}`,
  "instrument-sans": `"Instrument Sans Variable", ${sansFallback}`,
  pingfang: sansFallback,
  "geist-mono": `"Geist Mono Variable", ${monoFallback}`,
  "jetbrains-mono": `"JetBrains Mono Variable", ${monoFallback}`,
  "noto-serif": `"Noto Serif Variable", ${serifFallback}`,
  "roboto-slab": `"Roboto Slab Variable", ${serifFallback}`,
  merriweather: `"Merriweather Variable", ${serifFallback}`,
  lora: `"Lora Variable", ${serifFallback}`,
  "playfair-display": `"Playfair Display Variable", ${serifFallback}`,
  "eb-garamond": `"EB Garamond Variable", ${serifFallback}`,
  songti: serifFallback,
}
