import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('src/public/icon.svg');

await sharp(svg).resize(192, 192).png().toFile('src/public/icons/icon-192.png');
console.log('icon-192.png done');

await sharp(svg).resize(512, 512).png().toFile('src/public/icons/icon-512.png');
console.log('icon-512.png done');

await sharp(svg).resize(180, 180).png().toFile('src/public/icons/apple-touch-icon.png');
console.log('apple-touch-icon.png done');
