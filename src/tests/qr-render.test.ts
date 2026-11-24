import { afterAll, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { qrImage, validateQrTitle } from "../tools/extended/qr";
// Native canvas is an optional development dependency of PDF.js, never a runtime dependency.
const canvas = await import("@napi-rs/canvas").catch(() => null);
afterAll(() => vi.unstubAllGlobals());
describe.skipIf(!canvas)("Captioned QR decoding", () => {
  for (const input of [
    "12312323",
    "https://example.com",
    "开发者效率工具箱测试",
    "x".repeat(400),
  ])
    for (const position of ["top", "bottom", "center"] as const)
      for (const title of ["123123", "开发者工具箱", "开发者效率工具箱"])
        it(`decodes ${position} / ${title} / ${input.slice(0, 16)}`, async () => {
          vi.stubGlobal("document", {
            createElement: () => canvas!.createCanvas(1, 1),
          });
          const url = await qrImage(input, {
            level: "M",
            title,
            fontSize: 24,
            position,
            align: "center",
          });
          const image = await canvas!.loadImage(url),
            surface = canvas!.createCanvas(image.width, image.height),
            ctx = surface.getContext("2d");
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, image.width, image.height);
          expect(
            jsQR(new Uint8ClampedArray(pixels.data), image.width, image.height)
              ?.data,
          ).toBe(input);
        });
});
it("bounds center title length and font size", () => {
  const options = {
    level: "M",
    title: "12345678",
    fontSize: 24,
    position: "center",
    align: "center",
  } as const;
  expect(() => validateQrTitle(options)).not.toThrow();
  expect(() => validateQrTitle({ ...options, title: "123456789" })).toThrow(
    "qrCenterLimit",
  );
  expect(() => validateQrTitle({ ...options, fontSize: 25 })).toThrow(
    "qrCenterLimit",
  );
});

it.skipIf(!canvas)(
  "adapts a long outside title when switching to center",
  async () => {
    vi.stubGlobal("document", {
      createElement: () => canvas!.createCanvas(1, 1),
    });
    const input = "123123123123213213";
    const url = await qrImage(input, {
      level: "M",
      title: "这是超过八个字的完整中文标题",
      fontSize: 24,
      position: "center",
      align: "center",
    });
    const image = await canvas!.loadImage(url),
      surface = canvas!.createCanvas(image.width, image.height),
      ctx = surface.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, image.width, image.height);
    expect(
      jsQR(new Uint8ClampedArray(pixels.data), image.width, image.height)?.data,
    ).toBe(input);
  },
);
