import test from 'node:test';import assert from 'node:assert/strict';
import {passwordHash,verifyPassword,createSession,parseSession,validVin} from '../lib/auth.mjs';
test('password hashes are salted and verifiable',()=>{const a=passwordHash('distinct-strong-password-123'),b=passwordHash('distinct-strong-password-123');assert.notEqual(a,b);assert(verifyPassword('distinct-strong-password-123',a));assert(!verifyPassword('wrong',a))});
test('only approved admin can get a session',()=>{const secret='x'.repeat(48);const token=createSession('joshmobileinc@gmail.com','scrypt$dummy',secret);assert.equal(parseSession(token,secret).email,'joshmobileinc@gmail.com');assert.equal(parseSession(token,'y'.repeat(48)),null);assert.throws(()=>createSession('stranger@example.org','test',secret));});
test('VIN syntax rejects forbidden letters',()=>{assert(validVin('1HGCM82633A004352'));assert(!validVin('1HGCM82633A00435I'));assert(!validVin('short'));});
