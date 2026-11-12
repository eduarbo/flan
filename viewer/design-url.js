// SPDX-License-Identifier: GPL-3.0-or-later
export const designKeys=['size','theme','case','keys','frame','palette','design'];

// Edits replace the current entry; application Undo/Redo owns design history.
export function createDesignURL({encode,onLink,onError,location=window.location,history=window.history}){
 let last='';
 function schedule(configuration){
  const serialized=JSON.stringify(configuration);if(serialized===last)return;
   try{
    // Synchronous encoding closes the edit → reload gap, even before storage settles.
    const link=encode(configuration);
    onLink(link);
    // A downloaded viewer keeps its file address; its copyable link opens the website.
    if(/^https?:$/.test(location.protocol)){
     const next=new URL(location.href),encoded=new URL(link);
     for(const key of designKeys)next.searchParams.delete(key);
     for(const [key,value] of encoded.searchParams)next.searchParams.set(key,value);
     if(next.href!==location.href)history.replaceState(history.state,'',next.href);
    }
    last=serialized;
   }catch(error){onError(error);}
 }
 return {schedule};
}
