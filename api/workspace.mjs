export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
 const url=process.env.JM_GOOGLE_WEBAPP_URL||'';
 const connected=process.env.JM_ONLINE_INTAKE_ENABLED==='true'&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)&&!!process.env.JM_GOOGLE_API_SECRET;
 res.status(200).json({connected,ownerUrl:connected?url:null,bookingMode:connected?'google':'direct-message'});
}
