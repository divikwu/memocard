export function imageType(bytes: Uint8Array): { extension: string; mime: string } | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length > 24 && bytes.slice(0, 8).every((b, i) => b === [137, 80, 78, 71, 13, 10, 26, 10][i]) && ascii(12, 16) === "IHDR") return { extension: "png", mime: "image/png" };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", mime: "image/jpeg" };
  if (bytes.length > 10 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) return { extension: "gif", mime: "image/gif" };
  if (bytes.length > 16 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { extension: "webp", mime: "image/webp" };
  if (bytes.length > 16 && ascii(4, 8) === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(ascii(8, 12))) return { extension: "heic", mime: "image/heic" };
  return null;
}
