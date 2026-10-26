// Temporary isolated private prefix; no real account or invitation is consumed.
import {randomUUID} from 'node:crypto';
import {scenario} from '../tests/scenario.mjs';
import {cleanPrefix} from '../lib/private-store.mjs';
if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('Private storage is not connected.');
const names=['JM_DATA_PREFIX','JM_SESSION_SECRET','JM_OWNER_INVITE_HASH','JM_MANAGER_INVITE_HASH','JM_INVITE_EXPIRES','JM_BOOKING_ENABLED'];const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
process.env.JM_DATA_PREFIX='smoke/'+randomUUID()+'/';
try{const checks=await scenario();console.log('PRIVATE STORAGE ACCEPTANCE PASS:',checks.length,'checks');for(const name of checks)console.log('PASS:',name);}finally{await cleanPrefix();for(const [k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
