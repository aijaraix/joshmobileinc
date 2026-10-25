import test from 'node:test';import assert from 'node:assert/strict';import workspace from '../api/workspace.mjs';import booking from '../api/booking.mjs';
function response(){return {headers:{},code:null,data:null,setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(d){this.data=d;return this}};}
test('workspace disabled when unconfigured',()=>{const r=response();workspace({},r);assert.equal(r.code,200);assert.equal(r.data.connected,false);assert.equal(r.data.ownerUrl,null);});
test('booking GET never writes',async()=>{const r=response();await booking({method:'GET',headers:{}},r);assert.equal(r.code,405)});
test('booking rejects foreign origin',async()=>{const r=response();await booking({method:'POST',headers:{origin:'https://example.com'}},r);assert.equal(r.code,403)});
test('booking fails closed until activation',async()=>{const r=response();await booking({method:'POST',headers:{origin:'https://joshmobileinc.com','content-type':'application/json'}},r);assert.equal(r.code,503);assert(!r.data.ok)});
