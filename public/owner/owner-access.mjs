// This is a presentation-only mirror of ADMINS[0] in lib/auth.mjs. The API
// remains the authority for every owner-only operation.
export const OWNER_EMAIL='joshmobileinc@gmail.com';

export const isOwnerEmail=email=>String(email||'').trim().toLowerCase()===OWNER_EMAIL;

export function trashUiVisibility(email,job={}){
 const owner=isOwnerEmail(email),websiteRequest=job?.source!=='manual';
 return {
  showTrash:owner,
  showDelete:owner&&!job?.deletedAt&&websiteRequest&&['requested','cancelled'].includes(job?.status),
  showRestore:owner&&Boolean(job?.deletedAt)&&websiteRequest,
  showUndo:owner,
  showPurge:owner&&Boolean(job?.deletedAt)&&websiteRequest
 };
}
