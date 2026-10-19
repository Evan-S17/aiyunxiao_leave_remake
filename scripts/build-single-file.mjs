import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Script } from 'node:vm';

// Ship a ready-to-open file; end users do not need Node, npm, or a server.
let html = await readFile('dist/index.html', 'utf8');
const scriptTag = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const styleTag = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/);
if (!scriptTag || !styleTag) throw new Error('Expected one bundled script and stylesheet');
const script = await readFile(resolve('dist/assets', basename(scriptTag[1])), 'utf8');
const css = await readFile(resolve('dist/assets', basename(styleTag[1])), 'utf8');
// A classic inline script works from file:// without module loading or CORS.
new Script(script);
html = html.replace(scriptTag[0], '');
html = html.replace(styleTag[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
html = html.replace('</body>', () => `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>\n  </body>`);
await writeFile('请假记录.html', html);
console.log('Generated 请假记录.html — open directly in a browser, no server required.');
