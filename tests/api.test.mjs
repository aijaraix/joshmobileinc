import test from 'node:test';import assert from 'node:assert/strict';
import {memoryStore} from './memory-store.mjs';import {useTestStore,rate} from '../lib/private-store.mjs';import {scenario} from './scenario.mjs';import {validVin,passwordHash,verifyPassword,sign,unsign,same} from '../lib/auth.mjs';import {magicOK} from '../lib/media.mjs';
process.env.NODE_ENV='test';delete process.env.TELEGRAM_ALERTS_ENABLED;delete process.env.JM_ALERT_WEBHOOK_URL;delete process.env.JM_ALERT_WEBHOOK_SECRET;useTestStore(memoryStore());
test('Complete private booking and account lifecycle',async()=>{const checks=await scenario();console.log('Verified workflow checks:',checks.length);assert(checks.length>=25);});
test('VIN validity is enforced',()=>{assert(validVin('1HGCM82633A004352'));for(const bad of ['','123','IHGCM82633A004352','OHGCM82633A004352','QHGCM82633A004352'])assert(!validVin(bad));});
test('Strong password storage and incorrect passwords',async()=>{const p='a-long-unique-test-password',h=await passwordHash(p);assert(h.startsWith('scrypt17$'));assert(!h.includes(p));assert(await verifyPassword(p,h));assert(!await verifyPassword('not-the-right-password',h));assert(!await verifyPassword('short',h));});
test('Tampered and expired sessions rejected',()=>{process.env.JM_SESSION_SECRET='test-only-'.repeat(6);const token=sign({exp:Date.now()+10000});assert(unsign(token));assert(!unsign(token+'x'));assert(!unsign(sign({exp:Date.now()-1})));assert.equal(same('é','e'),false);});
test('Durable request limit blocks overflow',async()=>{await rate('test-limit',2);await rate('test-limit',2);await assert.rejects(()=>rate('test-limit',2),e=>e.status===429);});
test('Media magic validates actual image/container types',()=>{assert(magicOK('image/jpeg',Buffer.from('ffd8ff','hex')));assert(!magicOK('image/jpeg',Buffer.from('<html>')));assert(!magicOK('image/webp',Buffer.from('RIFF----HTML')));assert(magicOK('video/mp4',Buffer.from('000000186674797069736f6d','hex')));});

import {passwordHash as passwordHashMin12,verifyPassword as verifyPasswordMin12} from '../lib/auth.mjs';
import {test as testPasswordMin12} from 'node:test';
import {strict as assertPasswordMin12} from 'node:assert';
testPasswordMin12('Generated 12-character passwords are accepted; shorter passwords are rejected',async()=>{const accepted='Q6x!bR9%tY2z';const hashed=await passwordHashMin12(accepted);assertPasswordMin12.equal(await verifyPasswordMin12(accepted,hashed),true);await assertPasswordMin12.rejects(()=>passwordHashMin12('short12?'),/12/);});
