import type { FontChoice } from "./font-options";

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
      { value: "noto-sans-sc", label: "Noto Sans SC" },
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
