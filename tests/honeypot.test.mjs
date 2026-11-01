import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Website honeypot is never visible in customer booking UI',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
 assert.match(html,/<div class="honeypot" aria-hidden="true" hidden>/);
 assert.match(html,/<input name="website" tabindex="-1" autocomplete="off">/);
 assert.match(css,/\.honeypot\s*\{\s*display:\s*none\s*!important\s*\}/);
 assert.match(css,/\[hidden\]\s*\{\s*display:\s*none\s*!important\s*\}/);
});
