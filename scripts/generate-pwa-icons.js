import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate icon.svg
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="50%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="512" height="512" rx="110" fill="url(#bgGrad)" />
  <rect width="504" height="504" x="4" y="4" rx="106" fill="none" stroke="url(#accentGrad)" stroke-width="4" stroke-opacity="0.35" />

  <!-- Background Decorative Grid & Glow -->
  <circle cx="256" cy="256" r="160" fill="url(#glowGrad)" />

  <!-- Motorcycle & Speed Motif -->
  <g transform="translate(64, 96)" filter="url(#glow)">
    <!-- Back Wheel -->
    <circle cx="76" cy="210" r="48" fill="none" stroke="#10b981" stroke-width="16" />
    <circle cx="76" cy="210" r="20" fill="#0f172a" stroke="#06b6d4" stroke-width="8" />

    <!-- Front Wheel -->
    <circle cx="308" cy="210" r="48" fill="none" stroke="#10b981" stroke-width="16" />
    <circle cx="308" cy="210" r="20" fill="#0f172a" stroke="#06b6d4" stroke-width="8" />

    <!-- Motorcycle Chassis / Frame Lines -->
    <path d="M 76 210 L 160 140 L 220 140 L 260 90 L 285 90" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 160 140 L 195 210 L 308 210" fill="none" stroke="#06b6d4" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 120 170 L 250 170" fill="none" stroke="#6366f1" stroke-width="10" stroke-linecap="round" />
    
    <!-- Fuel Tank & Seat -->
    <path d="M 140 135 C 160 115, 200 115, 225 135 Z" fill="url(#accentGrad)" />
    <path d="M 95 142 Q 130 140 145 155" fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" />

    <!-- Handlebar & Headlight -->
    <circle cx="285" cy="90" r="9" fill="#10b981" />
    <line x1="285" y1="90" x2="310" y2="105" stroke="#ffffff" stroke-width="10" stroke-linecap="round" />
    <polygon points="315,100 350,90 350,120" fill="#facc15" opacity="0.85" />
  </g>

  <!-- Growth / Financial Chart Vector Overlay (Bottom Right) -->
  <g transform="translate(260, 270)">
    <rect x="10" y="80" width="22" height="40" rx="6" fill="#6366f1" opacity="0.8" />
    <rect x="42" y="55" width="22" height="65" rx="6" fill="#06b6d4" opacity="0.9" />
    <rect x="74" y="25" width="22" height="95" rx="6" fill="#10b981" />
    
    <!-- Upward Arrow -->
    <path d="M 10 75 L 42 50 L 74 20 L 96 20 M 96 20 L 96 36 M 96 20 L 80 20" fill="none" stroke="#34d399" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- App Title Label Text -->
  <text x="256" y="445" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#f8fafc" letter-spacing="4">MOTO<tspan fill="#10b981">GESTÃO</tspan></text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
console.log('Created /public/icon.svg');

// Helper to write an uncompressed/deflated raw PNG image with pure Node buffers
function createSolidPngBuffer(width, height, r, g, b, a = 255) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // Compression method
  ihdrData.writeUInt8(0, 11); // Filter method
  ihdrData.writeUInt8(0, 12); // Interlace method
  const ihdr = makeChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0 (None)
  const lineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * lineLength);
  
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * lineLength;
    rawData[rowOffset] = 0; // Filter 0
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      // Calculate distance from center for rounded badge look
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      
      // Gradient colors: Slate #0f172a to Indigo #1e1b4b
      const t = (x + y) / (width + height);
      let pr = Math.round(15 + t * 15);
      let pg = Math.round(23 + t * 5);
      let pb = Math.round(42 + t * 35);
      
      // Motorbike / Accent symbol circle inside
      const distSymbol = Math.sqrt((x - cx) ** 2 + (y - cy * 0.95) ** 2);
      if (distSymbol < width * 0.22 && distSymbol > width * 0.16) {
        // Emerald glowing ring
        pr = 16; pg = 185; pb = 129;
      } else if (distSymbol <= width * 0.16 && distSymbol > width * 0.08) {
        // Cyan inner
        pr = 6; pg = 182; pb = 212;
      }

      // Rounded border corner shading
      if (dist > radius) {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      } else {
        rawData[pixelOffset] = pr;
        rawData[pixelOffset + 1] = pg;
        rawData[pixelOffset + 2] = pb;
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressedData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeInt32BE(calculateCrc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crc]);
}

// Standard CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calculateCrc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

// Generate the required PNGs
const png192 = createSolidPngBuffer(192, 192, 16, 185, 129);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

const png512 = createSolidPngBuffer(512, 512, 16, 185, 129);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

const pngMaskable = createSolidPngBuffer(512, 512, 15, 23, 42);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable);

const appleTouch = createSolidPngBuffer(180, 180, 16, 185, 129);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);

// Create favicon.ico from 32x32 png
const favicon32 = createSolidPngBuffer(32, 32, 16, 185, 129);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon32);

console.log('All PWA icons successfully generated in /public!');
