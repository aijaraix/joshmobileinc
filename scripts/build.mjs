import {build} from 'esbuild';
await build({entryPoints:['public/upload-client.js'],bundle:true,platform:'browser',format:'esm',target:['es2022'],outfile:'public/upload.js',minify:true});
if(process.env.VERCEL_ENV==='production'&&process.env.JM_BOOKING_ENABLED==='true')await import('./smoke.mjs');
console.log('Release build complete.');
