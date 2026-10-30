"""One-time, owner-authorized public-site refresh. No credentials or customer data.
The generated source and verified media are committed by the bounded import job.
Run from repository root; safe to rerun after the refresh is already applied.
"""
from pathlib import Path
import hashlib
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
ASSETS = [
    ('hero-outside-v3.webp', 'https://cdn.openart.ai/openart-uploads/production/attachment-transfers/af79aa320d84d29f2b8b3fcce67fe8551946a47ce2c03811431dc15a89367c48.webp', '0a556a1e7f159c36964ebd7abdfe28f3db1d961fca72cdf6ec63d5473f78290b'),
    ('cabin-filters-real-v1.webp', 'https://cdn.openart.ai/openart-uploads/production/attachment-transfers/acc657e89c82fce5fd93b514a0f1579101c0e7875cdc0d64e142f3e8b638cec7.webp', 'd400eafa2a1b6094b70ad73719a799f1ba1802da8283d8372659d47011717490'),
    ('josh-mobile-share-blue-v3.jpg', 'https://cdn.openart.ai/openart-uploads/production/attachment-transfers/152c5cbc9922d8e3972c2a6fa28f315d04cc96e1148e31ac4f42d3d86f19c535.jpg', '29798157760ccd27503a785a81466ea49088e6b317a7926105e92d2250787bd1'),
]
for filename, url, digest in ASSETS:
    dest = PUBLIC / 'assets' / filename
    data = dest.read_bytes() if dest.exists() else urllib.request.urlopen(url, timeout=40).read(2_000_001)
    if len(data) > 2_000_000 or hashlib.sha256(data).hexdigest() != digest:
        raise RuntimeError('Asset integrity failed: ' + filename)
    dest.write_bytes(data)

p = PUBLIC / 'index.html'
s = p.read_text()
if 'brand-refresh-v3.css' not in s:
    # The new photo is the previously approved exterior scene, not the filter collage.
    s = s.replace('/assets/hero.webp', '/assets/hero-outside-v3.webp')
    s = s.replace('alt="Josh Mobile mechanic beside an open engine bay"', 'alt="Mechanic standing outside a vehicle beside its open engine bay"')
    s = s.replace('<link rel="stylesheet" href="/styles.css">', '<link rel="stylesheet" href="/styles.css">\n<link rel="stylesheet" href="/brand-refresh-v3.css">')
    s = s.replace('<script src="/app.js"', '<script src="/app.js?v=request-first-v3"')
    s = s.replace('<a class="header-phone" href="tel:+16467967322">(646) 796-7322</a>\n', '')
    s = s.replace('>Request service <span', '>Start a service request <span')
    s = s.replace('<a href="#book">Request service</a>', '<a href="#book">Start a service request</a>')
    s = s.replace('<a href="tel:+16467967322">Call (646) 796-7322</a>\n', '')
    s = s.replace('<a class="button outline-light" href="tel:+16467967322">Call Josh ↗</a>', '<a class="button outline-light" href="#services">Explore services</a>')
    s = s.replace('<p class="hero-note">By appointment only. North Broward County.</p>', '<p class="hero-note">Send your vehicle details and photos. We’ll review your request and follow up. By appointment only.</p>')
    s = s.replace('<strong>Talk directly with Josh</strong>', '<strong>Request on your schedule</strong>').replace('<span>Real answers from your mechanic.</span>', '<span>Send the details. We’ll follow up.</span>')
    s = s.replace('Tell Josh what yours needs', 'Tell us what yours needs').replace('Tell Josh about squealing', 'Tell us about squealing').replace('Tell Josh about rough', 'Tell us about rough').replace('Josh will confirm what can be inspected', 'We’ll confirm what can be inspected')
    s = s.replace('Photos show Josh’s work.', 'Service photos show our work.')
    s = s.replace('<h3>Make a plan with Josh</h3>', '<h3>We review your request</h3>').replace('Josh reviews the details, then contacts you', 'We review the details, then contact you')
    old = '<img src="/assets/maintenance-visit.webp" alt="A vehicle at a maintenance visit; service work photo" width="1000" height="1334" loading="lazy" style="object-position:50% 43%">'
    if old not in s:
        raise RuntimeError('Cabin-filter source card changed; review before applying.')
    s = s.replace(old, '<img src="/assets/cabin-filters-real-v1.webp" alt="A used cabin air filter beside a clean replacement from a service visit" width="1152" height="710" loading="lazy" style="object-position:50% 50%">')
    old_bio = '<p>Josh started his mobile mechanic business through word of mouth. Now it’s easier to see his work, tell him what your car needs, and arrange an appointment directly.</p>\n<p>From brake pads and rotors to suspension, ignition parts, filters, and general inspections, the goal is simple: practical car care, brought to you in North Broward County.</p>'
    new_bio = '<p>I’m Josh, a lifelong Coral Springs resident. I’m passionate about helping people understand what their cars need, what can wait, and why a repair is recommended.</p>\n<p>I started this business because I believe car care should come with honest, transparent advice. You deserve clear explanations and the chance to make informed decisions, without feeling pressured or left in the dark.</p>\n<p>Helping my neighbors is my way of giving back to the community I call home. Through appointment-only mobile service, I aim to make practical car care more approachable and convenient across North Broward.</p>'
    if old_bio not in s:
        raise RuntimeError('Biography source changed; review before applying.')
    s = s.replace(old_bio, new_bio).replace('See Josh’s work on Instagram', 'See our work on Instagram')
    s = s.replace('Share your city so Josh can confirm your address is within reach.', 'Share your city in the request so we can confirm your address is within reach.')
    s = s.replace('Ask Josh about an agreed meeting location.', 'Include a preferred meeting location in your request.').replace('Check your location with Josh ↗', 'Start a service request ↗')
    s = s.replace('<a href="tel:+16467967322">(646) 796-7322 ↗</a>', '<a href="#book">Request a visit ↗</a>')
    s = s.replace('Tell Josh about your vehicle and preferred date, then submit one private service request.', 'Tell us about your vehicle and preferred date, then submit one private service request.')
    s = s.replace('<strong>You’ll speak directly with Josh.</strong>', '<strong>Your request goes directly to your mechanic.</strong>').replace('<p>Not a call center. Not a middleman.</p>', '<p>All your vehicle details, together in one place.</p>')
    s, count = re.subn(r'<a class="contact-call" href="tel:\+16467967322">.*?</a>', '<div class="request-first-note"><strong>No need to call first.</strong><p>Send the details when it suits you. We’ll review the work and follow up using your preferred contact method.</p></div>', s, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError('Booking sidebar phone card changed.')
    s = s.replace('Josh confirms the date, work, location, parts, and price with you', 'We confirm the date, work, location, parts, and price with you')
    s = s.replace('What can Josh help with?', 'What does your vehicle need?').replace('Tell Josh about the work you need', 'Tell us about the work you need').replace('Josh confirms every appointment.', 'We confirm each appointment before a visit.').replace('How Josh can reach you', 'How we can reach you')
    s = s.replace('I agree Josh may contact me about this request. I understand the appointment isn’t confirmed until he replies.', 'I agree Josh Mobile may contact me about this request. I understand the appointment isn’t confirmed until we agree on the details.')
    s = s.replace('Josh will review your request and contact you.', 'We’ll review your request and contact you.').replace('What happens next: Josh reviews your vehicle and service details, then contacts you', 'What happens next: we review your vehicle and service details, then contact you').replace('Josh will reply to confirm availability and the estimate.', 'We’ll reply to confirm availability and the estimate.')
    s = s.replace('<a class="text-link" href="tel:+16467967322">Just ask Josh ↗</a>', '<a class="text-link" href="#book">Add your question to a service request ↗</a>')
    s = s.replace('Josh provides mobile mechanic service', 'We provide mobile mechanic service').replace('so he can confirm coverage', 'so we can confirm coverage').replace('Josh confirms availability, the work, location, parts, and price directly with you', 'We confirm availability, the work, location, parts, and price directly with you')
    s = s.replace('Can I bring my vehicle to Josh instead?', 'Can I bring my vehicle to you instead?').replace('Ask Josh about an agreed meeting location when requesting service.', 'Ask about an agreed meeting location in your service request.').replace('Josh will discuss an estimate before you approve any work.', 'We’ll discuss an estimate before you approve any work.')
    s = s.replace('<div class="footer-links">', '<div class="footer-links">\n<a class="footer-request" href="#book">Start a service request ↗</a>', 1)
    s = s.replace('<div class="mobile-bottom-bar">\n<a href="tel:+16467967322">Call Josh ↗</a>\n<a class="button small" href="#book">Start request ↗</a>', '<div class="mobile-bottom-bar">\n<a class="button small" href="#book">Start a service request ↗</a>')
    p.write_text(s)

# Metadata is server-rendered on every HTML route, including the staff sign-in
# and privacy page. Private records are never represented in sharing metadata.
share = 'https://joshmobileinc.com/assets/josh-mobile-share-blue-v3.jpg'
description = 'Mobile mechanic in North Broward County. Brakes, suspension, ignition, filters and inspections. Start a service request online. By appointment only.'
common = {
    'og:type': 'website', 'og:site_name': 'Josh Mobile', 'og:locale': 'en_US',
    'og:title': 'Josh Mobile — Your driveway. Our workshop.', 'og:description': description,
    'og:url': 'https://joshmobileinc.com/', 'og:image': share, 'og:image:secure_url': share,
    'og:image:type': 'image/jpeg', 'og:image:width': '1200', 'og:image:height': '630',
    'og:image:alt': 'Josh Mobile — blue-and-white service-request card with a mechanic standing outside a vehicle.',
}
for page in PUBLIC.rglob('*.html'):
    h = page.read_text()
    h = h.replace('https://joshmobileinc.com/assets/josh-mobile-share-photo-v2.jpg', share)
    # Remove old metadata before inserting a single consistent set.
    h = re.sub(r'<meta\s+(?:property|name)=["\'](?:og:[^"\']+|twitter:[^"\']+|theme-color)["\'][^>]*>\s*', '', h)
    tags = ['<meta name="theme-color" content="#0b2e5f">']
    tags += ['<meta property="'+key+'" content="'+value+'">' for key, value in common.items()]
    tags += [
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="'+common['og:title']+'">',
        '<meta name="twitter:description" content="'+description+'">',
        '<meta name="twitter:image" content="'+share+'">',
        '<meta name="twitter:image:alt" content="'+common['og:image:alt']+'">',
    ]
    if '</head>' not in h:
        raise RuntimeError('HTML head missing: '+str(page))
    h = h.replace('</head>', '\n'.join(tags)+'\n</head>', 1)
    page.write_text(h)

app = PUBLIC / 'app.js'
s = app.read_text().replace('Josh confirms the appointment.', 'We confirm the appointment.').replace('Josh confirms each request after reviewing the job.', 'We confirm each request after reviewing the job.').replace('Josh will review and contact you by ', 'We’ll review your request and contact you by ').replace('Josh will contact you after review.', 'We’ll contact you after reviewing the details.')
app.write_text(s)

css = '''/* Request-first public branding; source photographs are versioned. */
.hero{background:#0b2e5f;min-height:680px}
.hero-image{object-position:65% 42%}
.hero-shade{background:linear-gradient(90deg,rgba(5,29,62,.94) 0%,rgba(5,29,62,.82) 30%,rgba(5,29,62,.12) 61%,rgba(5,29,62,0) 90%)}
.hero h1{max-width:550px}
.hero-intro{max-width:440px}
.hero-note{max-width:440px;color:#e4f0ff;line-height:1.6}
.header-book{margin-left:auto;white-space:nowrap}
.request-first-note{margin:25px 0;padding:20px;border:1px solid #c8ddf2;border-radius:12px;background:#f1f7ff;color:#163759}
.request-first-note p{margin:8px 0 0;font-size:14px;line-height:1.6}
.footer-request{font-weight:700}
.service-card#service-cabin-filter .service-photo img{object-position:center}
@media(max-width:700px){
 .hero{min-height:0;display:flex;flex-direction:column}
 .hero-image{position:relative;inset:auto;height:310px;object-fit:cover;object-position:65% 35%;z-index:0}
 .hero-shade{display:none}
 .hero-content{padding:28px 24px 35px;width:100%;margin:0}
 .hero h1{font-size:48px;line-height:1.06;max-width:100%;margin-bottom:19px}
 .hero-intro{max-width:100%;margin-bottom:22px}
 .hero .button-row{gap:12px}
 .hero .button{font-size:13px}
 .hero-note{max-width:100%;font-size:13px}
 .hero-footnote{margin-top:26px}
 .mobile-bottom-bar{justify-content:center}
 .mobile-bottom-bar .button{width:100%;text-align:center;justify-content:center;font-size:14px}
 .about-copy p{font-size:15px;line-height:1.8}
}
@media(min-width:701px) and (max-width:1080px){.desktop-nav{gap:14px}.header-book{font-size:12px;padding:13px}.hero h1{font-size:63px;max-width:430px}}
'''
(PUBLIC/'brand-refresh-v3.css').write_text(css)
check = ROOT/'scripts/check.mjs'
s = check.read_text().replace('/assets/josh-mobile-share-photo-v2.jpg', '/assets/josh-mobile-share-blue-v3.jpg').replace("statSync('public/assets/josh-mobile-social.jpg')", "statSync('public/assets/josh-mobile-share-blue-v3.jpg')")
check.write_text(s)

(ROOT/'tests/public-brand.test.mjs').write_text('''import test from 'node:test';
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
''')
(ROOT/'docs/PUBLIC-BRAND-REFRESH.md').write_text('''# Request-first public website refresh

Owner-requested changes: request-first public calls to action; quiet footer phone contact; blue-and-white social metadata; approved exterior mechanic hero; genuine cabin-filter photograph in its service card only; and biography based on the supplied Coral Springs/community/transparent-advice notes.

## Asset provenance
- `hero-outside-v3.webp`: optimized from the exterior mechanic image previously generated in the owner's conversation and explicitly selected for website use. This is a generated promotional visual, not evidence of an actual repair.
- `josh-mobile-share-blue-v3.jpg`: 1200 × 630 dedicated blue/white card composed from that same exterior visual; not a website screenshot, and no filter inset.
- `cabin-filters-real-v1.webp`: cropped from the customer's supplied dirty/new cabin-filter photograph. Not AI-generated.

Images are vendored under public/assets with SHA-256 regression tests; the website and normal build do not depend on OpenArt or any external image service. The one-time import script retains the hash-verified transfer sources for reproducibility.

No backend, account, alert flags, environment variables, DNS or production data changes. Booking acceptance requiring an authorized live staff readback remains a separate gate. New static image URLs reduce reuse of the old asset; Facebook/Messenger/WhatsApp control their own cached previews, and their final rendered previews must be checked separately.
''')
# The import workflow is one-shot and must not survive in the released source.
workflow=ROOT/'.github/workflows/import-public-refresh.yml'
if workflow.exists():
    workflow.unlink()
print('Public request-first refresh applied; approved assets SHA-256 verified.')
