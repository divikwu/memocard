import { createElement } from "react";
import { Select } from "storybook/internal/components";
import { addons, types, useGlobals } from "storybook/manager-api";
import { create } from "storybook/theming";
import { interfaceThemeLabels } from "../ui/web/appearance/interface-theme-labels";

addons.setConfig({
  theme: create({ base: "light", brandTitle: "MemoCard UI" }),
});

const interfaceThemeOptions = Object.entries(interfaceThemeLabels).map(([value, label]) => ({
  value,
  title: label,
}));

function InterfaceThemeToolbar() {
  const [globals, updateGlobals] = useGlobals();
  const selected = interfaceThemeOptions.find(option => option.value === globals.interfaceTheme) ?? interfaceThemeOptions[0];
  return createElement(Select, {
    ariaLabel: "界面主题",
    tooltip: "界面主题",
    options: interfaceThemeOptions,
    defaultOptions: [selected.value],
    showSelectedOptionTitle: false,
    children: `界面主题 · ${selected.title}`,
    onSelect: interfaceTheme => updateGlobals({ interfaceTheme }),
  });
}

addons.register("memocard/appearance", () => {
  addons.add("memocard/appearance/interface-theme", {
    type: types.TOOL,
    title: "界面主题",
    match: ({ viewMode, storyId }) => viewMode === "story" && Boolean(storyId?.startsWith("ui-web--")),
    render: () => createElement(InterfaceThemeToolbar),
  });
});
