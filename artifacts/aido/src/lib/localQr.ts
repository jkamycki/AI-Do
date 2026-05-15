const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
};

const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292];
const DATA_CODEWORDS_L = [0, 19, 34, 55, 80, 108, 136, 156, 194, 232];

type Matrix = boolean[][];

function bitBufferPush(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) bits.push(((value >>> i) & 1) === 1 ? 1 : 0);
}

function textBytes(text: string) {
  return Array.from(new TextEncoder().encode(text));
}

function pickVersion(byteLength: number) {
  for (let version = 1; version <= 6; version++) {
    if (byteLength + 2 <= DATA_CODEWORDS_L[version]) return version;
  }
  throw new Error("QR code payload is too long");
}

function buildDataCodewords(text: string, version: number) {
  const bytes = textBytes(text);
  const capacityBits = DATA_CODEWORDS_L[version] * 8;
  const bits: number[] = [];
  bitBufferPush(bits, 0b0100, 4);
  bitBufferPush(bits, Math.min(bytes.length, 255), 8);
  bytes.forEach((byte) => bitBufferPush(bits, byte, 8));
  bitBufferPush(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  for (let pad = 0xec; codewords.length < DATA_CODEWORDS_L[version]; pad ^= 0xec ^ 0x11) {
    codewords.push(pad);
  }
  return codewords;
}

const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

function gfMul(a: number, b: number) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function reedSolomonGenerator(degree: number) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const result = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    generator.forEach((coef, index) => {
      result[index] ^= gfMul(coef, factor);
    });
  }
  return result;
}

function blankMatrix(size: number) {
  return {
    modules: Array.from({ length: size }, () => Array(size).fill(false)) as Matrix,
    reserved: Array.from({ length: size }, () => Array(size).fill(false)) as Matrix,
  };
}

function setModule(modules: Matrix, reserved: Matrix, row: number, col: number, value: boolean, reserve = true) {
  if (row < 0 || col < 0 || row >= modules.length || col >= modules.length) return;
  modules[row][col] = value;
  if (reserve) reserved[row][col] = true;
}

function drawFinder(modules: Matrix, reserved: Matrix, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setModule(modules, reserved, rr, cc, dark);
    }
  }
}

function drawPatterns(modules: Matrix, reserved: Matrix, version: number) {
  const size = modules.length;
  drawFinder(modules, reserved, 0, 0);
  drawFinder(modules, reserved, 0, size - 7);
  drawFinder(modules, reserved, size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setModule(modules, reserved, 6, i, i % 2 === 0);
    setModule(modules, reserved, i, 6, i % 2 === 0);
  }

  for (const row of ALIGNMENT_POSITIONS[version]) {
    for (const col of ALIGNMENT_POSITIONS[version]) {
      if (reserved[row][col]) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          setModule(modules, reserved, row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    setModule(modules, reserved, 8, i, false);
    setModule(modules, reserved, i, 8, false);
    setModule(modules, reserved, 8, size - 1 - i, false);
    setModule(modules, reserved, size - 1 - i, 8, false);
  }
  setModule(modules, reserved, size - 8, 8, true);
}

function formatBits() {
  let data = (1 << 3) | 0; // error correction L, mask 0
  let value = data << 10;
  const divisor = 0x537;
  for (let i = 14; i >= 10; i--) {
    if (((value >>> i) & 1) !== 0) value ^= divisor << (i - 10);
  }
  return ((data << 10) | value) ^ 0x5412;
}

function drawFormatBits(modules: Matrix) {
  const size = modules.length;
  const bits = formatBits();
  for (let i = 0; i <= 5; i++) modules[8][i] = ((bits >>> i) & 1) !== 0;
  modules[8][7] = ((bits >>> 6) & 1) !== 0;
  modules[8][8] = ((bits >>> 7) & 1) !== 0;
  modules[7][8] = ((bits >>> 8) & 1) !== 0;
  for (let i = 9; i < 15; i++) modules[14 - i][8] = ((bits >>> i) & 1) !== 0;
  for (let i = 0; i < 8; i++) modules[size - 1 - i][8] = ((bits >>> i) & 1) !== 0;
  for (let i = 8; i < 15; i++) modules[8][size - 15 + i] = ((bits >>> i) & 1) !== 0;
}

function placeData(modules: Matrix, reserved: Matrix, codewords: number[]) {
  const bits = codewords.flatMap((byte) =>
    Array.from({ length: 8 }, (_, index) => ((byte >>> (7 - index)) & 1) !== 0),
  );
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset++) {
        const c = col - offset;
        if (reserved[row][c]) continue;
        const raw = bitIndex < bits.length ? bits[bitIndex++] : false;
        modules[row][c] = raw !== ((row + c) % 2 === 0);
      }
    }
    upward = !upward;
  }
}

function makeMatrix(text: string) {
  const version = pickVersion(textBytes(text).length);
  const size = version * 4 + 17;
  const { modules, reserved } = blankMatrix(size);
  drawPatterns(modules, reserved, version);
  const dataCodewords = buildDataCodewords(text, version);
  const ecc = reedSolomonRemainder(dataCodewords, TOTAL_CODEWORDS[version] - DATA_CODEWORDS_L[version]);
  placeData(modules, reserved, [...dataCodewords, ...ecc]);
  drawFormatBits(modules);
  return modules;
}

export function qrSvgMarkup(text: string, scale = 6, margin = 4) {
  const matrix = makeMatrix(text);
  const size = matrix.length + margin * 2;
  const rects = matrix.flatMap((row, r) =>
    row.map((dark, c) =>
      dark ? `<rect x="${(c + margin) * scale}" y="${(r + margin) * scale}" width="${scale}" height="${scale}"/>` : "",
    ),
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * scale}" height="${size * scale}" viewBox="0 0 ${size * scale} ${size * scale}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#111827">${rects}</g></svg>`;
}

export function qrSvgDataUrl(text: string, scale = 6, margin = 4) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvgMarkup(text, scale, margin))}`;
}

export async function qrPngDataUrl(text: string, pixels = 420) {
  const image = new Image();
  image.src = qrSvgDataUrl(text, 8, 4);
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not render QR code"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create QR canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, pixels, pixels);
  ctx.drawImage(image, 0, 0, pixels, pixels);
  return canvas.toDataURL("image/png");
}
