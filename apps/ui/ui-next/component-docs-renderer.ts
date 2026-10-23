import { DocsRenderer } from "@storybook/addon-docs";

// Keep the template state when Storybook repeats a render for the same Docs
// context. The Docs container updates the active theme through its own channel.
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
