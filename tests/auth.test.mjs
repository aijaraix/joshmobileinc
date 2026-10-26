import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {passwordHash,verifyPassword,createSession,parseSession,validVin} from '../lib/auth.mjs';
test('administrator passwords are salted scrypt hashes',()=>{
 const one=passwordHash('my-long-test-password'),two=passwordHash('my-long-test-password');
 assert.notEqual(one,two);assert(verifyPassword('my-long-test-password',one));assert(!verifyPassword('incorrect-password',one));
});
test('sessions reject changes and expire',()=>{
 const secret=randomBytes(48).toString('base64url'),hash=passwordHash('my-long-test-password'),now=Date.now();
 const token=createSession('joshmobileinc@gmail.com',hash,secret,now);
 assert.equal(parseSession(token,secret,now)?.email,'joshmobileinc@gmail.com');
 assert.equal(parseSession(token+'x',secret,now),null);
 assert.equal(parseSession(token,secret,now+43200001),null);
 assert.throws(()=>createSession('random@example.com',hash,secret));
});
test('VINs must be exactly 17 permitted characters',()=>{
 assert(validVin('1HGCM82633A004352'));
 assert(!validVin('1HGCM82633A00435I'));
 assert(!validVin('1234567890'));
});
