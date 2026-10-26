import sharp from "sharp";

/** Signature manuscrite fictive (tracé vectoriel) convertie en PNG data URL. */
export async function fakeSignature(seed: number): Promise<string> {
  const r = (n: number) => ((Math.sin(seed * 97 + n * 13.37) + 1) / 2) * 18 - 9;
  const d = [
    `M 20 ${70 + r(1)}`,
    `C 40 ${10 + r(2)}, 70 ${10 + r(3)}, 70 ${60 + r(4)}`,
    `S 95 ${95 + r(5)}, 120 ${45 + r(6)}`,
    `S 150 ${20 + r(7)}, 165 ${65 + r(8)}`,
    `S 200 ${80 + r(9)}, 220 ${40 + r(10)}`,
    `S 255 ${30 + r(11)}, 270 ${62 + r(12)}`,
    `M 60 ${82 + r(13)} C 120 ${70 + r(14)}, 200 ${92 + r(15)}, 285 ${72 + r(16)}`,
  ].join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110" viewBox="0 0 300 110"><path d="${d}" fill="none" stroke="#1d2b5a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
