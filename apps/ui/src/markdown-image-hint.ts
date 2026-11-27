export function mayContainMarkdownImage(body: string) {
  return body.includes("![") || /<img\b/i.test(body);
}
