import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const html=readFileSync('public/index.html','utf8');
const beforeFooter=html.split('<footer class="site-footer">')[0];
test('primary public calls to action request service, not a phone call',()=>{
 assert(!beforeFooter.includes('href="tel:'));
 assert(!html.includes('Call Josh'));
 assert.match(html, /Start a service request/);
 assert.match(html.split('<div class="mobile-bottom-bar">')[1], /href="#book"/);
 assert(html.includes('tel:+16467967322'));
});
test('approved exterior hero and genuine cabin-filter service photograph are distinct',()=>{
 assert(html.includes('/assets/hero-outside-v3.webp'));
 assert(html.includes('/assets/cabin-filters-real-v1.webp'));
 assert(!html.includes('/assets/hero.webp'));
 assert.equal((html.match(/cabin-filters-real-v1.webp/g)||[]).length,1);
});
test('biography uses supplied local and transparent-care facts without invented credentials',()=>{
 assert(html.includes('lifelong Coral Springs resident'));
 assert(html.includes('honest, transparent advice'));
 assert(html.includes('giving back to the community'));
});
test('all static HTML has the same blue photographic social image and explicit dimensions',()=>{
 function visit(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+item.name;if(item.isDirectory())visit(p);else if(p.endsWith('.html')){const s=readFileSync(p,'utf8');assert(!s.includes('josh-mobile-share-photo-v2.jpg'),p);assert.equal((s.match(/property="og:image"/g)||[]).length,1,p);assert(s.includes('josh-mobile-share-blue-v3.jpg'),p);assert(s.includes('property="og:image:width" content="1200"'),p);assert(s.includes('property="og:image:height" content="630"'),p);assert(s.includes('name="theme-color" content="#0b2e5f"'),p);}}}visit('public');
});
test('versioned public media matches the reviewed image bytes',()=>{
 const assets={
 'hero-outside-v3.webp':'0a556a1e7f159c36964ebd7abdfe28f3db1d961fca72cdf6ec63d5473f78290b',
 'cabin-filters-real-v1.webp':'d400eafa2a1b6094b70ad73719a799f1ba1802da8283d8372659d47011717490',
 'josh-mobile-share-blue-v3.jpg':'29798157760ccd27503a785a81466ea49088e6b317a7926105e92d2250787bd1'};
 for(const [name,digest]of Object.entries(assets))assert.equal(createHash('sha256').update(readFileSync('public/assets/'+name)).digest('hex'),digest);
});

const publicStyles=readFileSync('public/styles.css','utf8');
test('public palette uses blue and neutral tokens for controls, accents and surfaces',()=>{
 for(const legacy of ['#dbf479','#538718','#d0eb65','#839671','#33462c','#4a5c39','#e9eedf','#dfe5d9','--forest','--lime'])assert(!publicStyles.toLowerCase().includes(legacy.toLowerCase()),legacy+' remains in public CSS');
 assert(publicStyles.includes('--navy:#0a3266'));
 assert(publicStyles.includes('.service-number{background:#0a4b8d;color:#fff'));
});
