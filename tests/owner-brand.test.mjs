import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const html=readFileSync('public/owner/index.html','utf8');
const css=readFileSync('public/owner/dashboard.css','utf8');
const manifest=JSON.parse(readFileSync('public/owner/manifest.webmanifest','utf8'));
const worker=readFileSync('public/owner/service-worker.js','utf8');

test('owner browser and install metadata use the current blue palette and shared font',()=>{
 assert.match(html,/name="theme-color" content="#0a3266"/);
 assert.match(html,/rel="apple-touch-icon" href="\/assets\/josh-mobile-touch-icon-blue-v4\.png"/);
 assert.equal(manifest.theme_color,'#0a3266');
 assert.equal(manifest.background_color,'#ffffff');
 assert.match(css,/:root\{font-family:Arial,Helvetica,sans-serif/);
 assert.doesNotMatch(css,/font-family:Inter/i);
 assert.doesNotMatch(css,/#(?:def6ea|1b7651)/i);
 assert.match(css,/\.status\.confirmed\{background:#e4f2ff;color:#0a4b8d\}/);
});

test('owner install and notification icons have full PNG fallbacks in the blue brand',()=>{
 const icons=new Map(manifest.icons.map(icon=>[icon.sizes,icon]));
 for(const [size,path] of [['192x192','public/owner/app-icon-192.png'],['512x512','public/owner/app-icon-512.png']]){
  assert.equal(icons.get(size)?.type,'image/png');
  assert(icons.get(size)?.purpose.includes('maskable'));
  assert(existsSync(path),`Missing ${path}`);
  assert.deepEqual([...readFileSync(path).subarray(0,8)],[137,80,78,71,13,10,26,10]);
 }
 assert(existsSync('public/assets/apple-touch-icon.png'));
 assert(existsSync('public/assets/josh-mobile-touch-icon-blue-v4.png'));
 assert.deepEqual([...readFileSync('public/assets/josh-mobile-touch-icon-blue-v4.png').subarray(0,8)],[137,80,78,71,13,10,26,10]);
 const icon=readFileSync('public/owner/app-icon.svg','utf8');
 assert(icon.includes('fill="#0a3266"')&&icon.includes('fill="#66bdff"')&&icon.includes('>JM</text>'));
 assert.match(worker,/jm-owner-shell-v2/);
 assert.match(worker,/icon:'\/owner\/app-icon-192\.png',badge:'\/owner\/app-icon-192\.png'/);
});

test('owner CRM mobile layout keeps navigation and controls inside safe tap areas',()=>{
 assert.match(css,/\.crm-sidebar\{position:sticky/);
 assert.match(css,/\.crm-sidebar\.open\{transform:translateX\(0\)\}/);
 assert.match(css,/\.icon-button\{min-width:44px;min-height:44px\}/);
 assert.match(css,/env\(safe-area-inset-top\)/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/:focus-visible\{outline:3px solid #66bdff/);
});
