import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ADMINS} from '../lib/auth.mjs';
import {OWNER_EMAIL,isOwnerEmail,trashUiVisibility} from '../public/owner/owner-access.mjs';

test('a non-owner dashboard does not render trash-management actions',()=>{
 const activeWebsiteRequest={source:'website',status:'requested'},deletedWebsiteRequest={source:'website',status:'requested',deletedAt:'2026-11-13T00:00:00.000Z'};
 assert.equal(OWNER_EMAIL,ADMINS[0]);
 assert.equal(isOwnerEmail(ADMINS[1]),false);
 assert.deepEqual(trashUiVisibility(ADMINS[1],activeWebsiteRequest),{showTrash:false,showDelete:false,showRestore:false,showUndo:false,showPurge:false});
 assert.deepEqual(trashUiVisibility(ADMINS[1],deletedWebsiteRequest),{showTrash:false,showDelete:false,showRestore:false,showUndo:false,showPurge:false});
 assert.equal(trashUiVisibility(ADMINS[0],activeWebsiteRequest).showDelete,true);
 assert.equal(trashUiVisibility(ADMINS[0],deletedWebsiteRequest).showRestore,true);
 const dashboard=readFileSync(new URL('../public/owner/dashboard.js',import.meta.url),'utf8');
 assert.match(dashboard,/canSoftDeleteRequest=job=>trashUiVisibility\(ownerEmail,job\)\.showDelete/);
 assert.match(dashboard,/canRestoreRequest=job=>trashUiVisibility\(ownerEmail,job\)\.showRestore/);
 assert.match(dashboard,/showDeleted\.hidden=!trashUiVisibility\(ownerEmail\)\.showTrash/);
 assert.match(dashboard,/if\(next==='trash'&&!isOwner\(\)\)next='jobs'/);
 assert.match(dashboard,/if\(!trashUiVisibility\(ownerEmail\)\.showUndo\)/);
});
