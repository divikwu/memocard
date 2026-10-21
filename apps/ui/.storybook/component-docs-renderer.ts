import { DocsRenderer } from "@storybook/addon-docs";

// Storybook 10.6.2 gives every DocsRenderer.render call a random React key.
// The component Docs container subscribes to globals itself, so keep its mounted tree on those
// repeat calls. New contexts (navigation/HMR) still render through Storybook.
export async function componentDocsRenderer() {
  const renderer = new DocsRenderer();
  let previous: Parameters<typeof renderer.render> | undefined;
  return {
    render: (...args: Parameters<typeof renderer.render>) => {
      if (previous?.every((value, index) => value === args[index])) return Promise.resolve();
      previous = args;
      return renderer.render(...args);
    },
    unmount: (element: HTMLElement) => {
      previous = undefined;
      renderer.unmount(element);
    },
  };
}
