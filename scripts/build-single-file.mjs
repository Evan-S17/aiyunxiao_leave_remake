import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Script } from 'node:vm';
import { deflateRawSync } from 'node:zlib';

function asciiJavaScript(source) {
  // Use JS escapes in scripts, not HTML entities. This keeps Chinese strings
  // readable even when a local viewer guesses a legacy character encoding.
  return source.replace(/[^\x00-\x7f]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function singleFileZip(name, contents) {
  const filename = Buffer.from(name, 'ascii');
  const data = Buffer.from(contents, 'ascii');
  const compressed = deflateRawSync(data);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // DEFLATE
  local.writeUInt16LE(33, 12); // 1980-01-01, deterministic archive timestamp
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + compressed.length, 16);
  return Buffer.concat([local, filename, compressed, central, filename, end]);
}

// Ship a ready-to-open file; end users do not need Node, npm, or a server.
let html = await readFile('dist/index.html', 'utf8');
const scriptTag = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const styleTag = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
if (!scriptTag || !styleTag) throw new Error('Expected one bundled script and stylesheet');
const script = await readFile(resolve('dist/assets', basename(scriptTag[1])), 'utf8');
const css = await readFile(resolve('dist/assets', basename(styleTag[1])), 'utf8');
// A classic inline script works from file:// without module loading or CORS.
const inlineScript = asciiJavaScript(script);
new Script(inlineScript);
html = html.replace(scriptTag[0], '');
html = html.replace(styleTag[0], () => `<style>${css.replace(/[^\x00-\x7f]/g, character => `\\${character.charCodeAt(0).toString(16)} `).replace(/<\/style/gi, '<\\/style')}</style>`);
// Scripts and styles are already ASCII; only HTML text/attributes become entities.
html = html.replace(/[^\x00-\x7f]/gu, character => `&#x${character.codePointAt(0).toString(16)};`);
html = html.replace('</body>', () => `<script>${inlineScript.replace(/<\/script/gi, '<\\/script')}</script>\n  </body>`);
if (/[^\x00-\x7f]/.test(html)) throw new Error('Standalone HTML must be encoding-independent ASCII');
await writeFile('请假记录.html', html);
await writeFile('leave.html', html);
await writeFile('leave-offline.zip', singleFileZip('leave.html', html));
console.log('Generated leave-offline.zip, leave.html and 请假记录.html — no server required.');
