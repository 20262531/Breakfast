import {today,roomNumber,validateEntry} from './domain.js';
const DB='laya-breakfast-local-v1', KEY='state';
const empty=()=>({days:{},rateRules:{mapping:{},version:null},revision:null,changedAt:null,backupRevision:null,backupAt:null});
const clone=x=>structuredClone(x);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const fail=()=>{throw new Error('ไฟล์สำรองไม่ถูกต้องหรือข้อมูลไม่ครบ ไม่ได้เปลี่ยนข้อมูลในเครื่อง');};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
export function validateBackupState(state){
 if(!plain(state)||!plain(state.days)||!plain(state.rateRules)||!plain(state.rateRules.mapping))fail();
 if(Object.keys(state.days).length>10000||Object.keys(state.rateRules.mapping).length>1000)fail();
 for(const [code,pkg] of Object.entries(state.rateRules.mapping))if(!code||code.length>300||!['RO','RB'].includes(pkg))fail();
 for(const [date,x] of Object.entries(state.days)){
  if(!validDate(date)||!plain(x)||!plain(x.day)||!plain(x.day.rooms)||!plain(x.counts)||!Array.isArray(x.events)||typeof x.day.version!=='string')fail();
  if(Object.keys(x.day.rooms).length>1500||x.events.length>100000)fail();
  for(const [room,r] of Object.entries(x.day.rooms)){
   if(roomNumber(room)!==room||!plain(r)||r.room!==room||!Array.isArray(r.names)||r.names.length<1||r.names.length>50||r.names.some(n=>typeof n!=='string'||!n.trim()||n.length>300)||!Number.isInteger(r.pax)||r.pax<0||r.pax>50||!['RO','RB','REVIEW'].includes(r.pkg)||(r.pkg!=='REVIEW'&&r.pax===0))fail();
  }
  const ids=new Set(),counts={};
  for(const e of x.events){
   if(!plain(e)||typeof e.id!=='string'||!e.id||ids.has(e.id)||roomNumber(e.room)!==e.room||!Array.isArray(e.names)||!e.names.length||e.names.some(n=>typeof n!=='string'||n.length>300)||!Number.isInteger(e.pax)||e.pax<1||e.pax>50||!Number.isInteger(e.amount)||e.amount<0||e.amount>100000000||typeof e.staffEmail!=='string'||Number.isNaN(Date.parse(e.createdAt)))fail();
   if(!(e.pkg==='RB'&&e.amount===0&&e.method==='')&&!(e.pkg==='RO'&&e.amount>0&&['cash','card','transfer'].includes(e.method)))fail();
   ids.add(e.id);counts[e.room]=(counts[e.room]||0)+e.pax;
  }
  if(Object.keys(x.counts).length!==Object.keys(counts).length)fail();
  for(const [room,n] of Object.entries(counts))if(!plain(x.counts[room])||x.counts[room].count!==n)fail();
 }
 return state;
}
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function readBackup(text){
 let payload;try{payload=JSON.parse(text);}catch{fail();}
 if(payload?.format!=='LAYA_BREAKFAST_LOCAL'||payload.schema!==1||typeof payload.checksum!=='string'||await digest(payload.state)!==payload.checksum)fail();
 validateBackupState(payload.state);return payload;
}
export async function localStore(){
 if(!globalThis.indexedDB)throw new Error('เบราว์เซอร์นี้ไม่รองรับการเก็บข้อมูลในเครื่อง กรุณาใช้ Chrome หรือ Edge');
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('data');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(new Error('กรุณาปิดแท็บแอปอื่นก่อนเปิดใหม่'));});
 db.onversionchange=()=>db.close();
 const listeners=new Set();const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(DB):null;
 function transaction(mode,change){return new Promise((resolve,reject)=>{
  const tx=db.transaction('data',mode),bucket=tx.objectStore('data');let result,problem;
  const q=bucket.get(KEY);q.onsuccess=()=>{try{const state=q.result||empty();result=change(state,bucket);if(mode==='readwrite')bucket.put(state,KEY);}catch(e){problem=e;tx.abort();}};
  tx.oncomplete=()=>resolve(clone(result));tx.onabort=()=>reject(problem||tx.error||new Error('บันทึกไม่สำเร็จ'));tx.onerror=()=>{};
 });}
 const read=()=>transaction('readonly',s=>s);
 async function emit(){const state=await read();for(const {date,cb} of listeners){const x=state.days[date]||{};cb({day:x.day||null,counts:x.counts||{},events:x.events||[],fresh:true});}}
 if(channel)channel.onmessage=()=>emit().catch(console.error);
 const changed=s=>{s.revision=crypto.randomUUID();s.changedAt=new Date().toISOString();};
 async function write(fn){const out=await transaction('readwrite',s=>{const result=fn(s);changed(s);return result;});await emit();channel?.postMessage('changed');return out;}
 const store={local:true,demo:false,user:{uid:'local-notebook',email:'โน้ตบุ๊กห้องอาหาร',role:'admin'},
  watch(date,cb,error){const listener={date,cb};listeners.add(listener);read().then(s=>{if(!listeners.has(listener))return;const x=s.days[date]||{};cb({day:x.day||null,counts:x.counts||{},events:x.events||[],fresh:true});}).catch(error||console.error);return()=>listeners.delete(listener);},
  async getDay(date){return (await read()).days[date]?.day||null;},
  async getRateRules(){return (await read()).rateRules;},
  async saveRateRules(mapping,version){await write(s=>{if(s.rateRules.version!==version)throw new Error('รหัสราคาเปลี่ยนแล้ว กรุณาอ่านใหม่');s.rateRules={mapping:clone(mapping),version:crypto.randomUUID()};});},
  async importDay(date,rooms,version){if(!validDate(date))throw new Error('วันที่ไม่ถูกต้อง');await write(s=>{const x=s.days[date]||{counts:{},events:[]};if((x.day?.version||null)!==version)throw new Error('มีการนำเข้าข้อมูลใหม่ กรุณาตรวจใหม่');x.day={rooms:clone(rooms),version:crypto.randomUUID(),uploadedBy:store.user.uid,uploadedAt:new Date().toISOString()};s.days[date]=x;});},
  async checkin(date,room,pax,amount,method,id,expected){await write(s=>{
   if(date!==today())throw new Error('เปลี่ยนวันแล้ว กรุณาค้นหาใหม่');const x=s.days[date];if(!x)throw new Error('ยังไม่มีรายงานของวันนี้');if(x.events.some(e=>e.id===id))return;
   const r=x.day.rooms[room];if(JSON.stringify(r)!==JSON.stringify(expected))throw new Error('ข้อมูลห้องเปลี่ยน กรุณาค้นหาใหม่');roomNumber(room);validateEntry(r,x.counts[room]?.count||0,pax,amount,method);
   if(r.pkg==='RB'&&(amount!==0||method!==''))throw new Error('RB ต้องไม่มียอดรับชำระ');
   x.counts[room]={count:(x.counts[room]?.count||0)+pax,lastEvent:id};x.events.push({id,room,names:clone(r.names),pkg:r.pkg,pax,amount,method,staffEmail:store.user.email,createdAt:new Date().toISOString()});
  });},
  async status(){const s=await read();return {dirty:!!s.revision&&s.revision!==s.backupRevision,backupAt:s.backupAt,days:Object.keys(s.days).length,events:Object.values(s.days).reduce((n,x)=>n+x.events.length,0)};},
  async exportBackup(){const state=await read();const payload={format:'LAYA_BREAKFAST_LOCAL',schema:1,exportedAt:new Date().toISOString(),state,checksum:await digest(state)};return {text:JSON.stringify(payload),revision:state.revision};},
  async markBackup(revision){await transaction('readwrite',s=>{s.backupRevision=revision;s.backupAt=new Date().toISOString();return null;});},
  async restoreBackup(payload,expectedRevision){validateBackupState(payload.state);await transaction('readwrite',(s,bucket)=>{
   if(s.revision!==expectedRevision)throw new Error('ข้อมูลเปลี่ยนระหว่างตรวจไฟล์ กรุณาเลือกไฟล์สำรองใหม่');bucket.put(clone(s),'before-restore');
   const restored=clone(payload.state);Object.assign(s,restored);changed(s);s.backupRevision=null;s.backupAt=null;return null;
  });await emit();channel?.postMessage('changed');},
  async logout(){},async close(){channel?.close();db.close();}
 };
 await read();if(navigator.storage?.persist)try{await navigator.storage.persist();}catch{}
 return store;
}
