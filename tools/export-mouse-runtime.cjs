'use strict';
const fs=require('fs'),path=require('path');
const id=process.argv[2];
if(!id||!/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(id))
  throw Error('Usage: node tools/export-mouse-runtime.cjs RECEIVER-CONTAINER-GUID');
const receiver='{'+id.replace(/[{}]/g,'').toUpperCase()+'}';
const key='synapse_179_'+receiver;
if(!process.env.LOCALAPPDATA)throw Error('Windows LOCALAPPDATA is required');
const root=path.join(process.env.LOCALAPPDATA,'Razer','RazerAppEngine','User Data','Logs');
const records=[];
for(const name of fs.readdirSync(root)) {
  if(!name.toUpperCase().startsWith(('products_179_mw '+receiver).toUpperCase())||!name.endsWith('.log'))continue;
  for(const line of fs.readFileSync(path.join(root,name),'utf8').split('\n')) {
    const marker='args: {"action":"localStorageSetItem"';
    const at=line.indexOf(marker);if(at<0)continue;
    const start=at+6,end=line.lastIndexOf(' , r:');
    let action;
    try{action=JSON.parse(line.slice(start,end>start?end:undefined));}catch{continue;}
    if(action.payload?.key?.toUpperCase()===key.toUpperCase())records.push({time:line.slice(0,26),payload:action.payload});
  }
}
records.sort((a,b)=>a.time.localeCompare(b.time));
const record=records.at(-1);
if(!record)throw Error('No original runtime payload found for that receiver. Nothing exported.');
const data=JSON.parse(record.payload.value);
const active=data.profiles?.find(p=>p.guid===data.activeProfile);
if(data.vendorId!==5426||data.productId!==179||!active?.appEngine?.mappings?.length)
  throw Error('Latest payload has no active mapping table. Nothing exported.');
const destination=path.join(__dirname,'..','private-runtime','mouse-runtime-snapshot.json');
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,JSON.stringify(record.payload,null,2));
console.log('Exported local snapshot from '+record.time+' to '+destination);
console.log('Check it against your current bindings before applying. Do not upload this private snapshot.');
