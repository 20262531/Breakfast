export function createAutoBackup({getStore,download,notify,onStatus}){
 let timer=null,queue=Promise.resolve(),lastRevision,folder=null,loadedFor=null,status='ยังไม่ได้ตั้งค่าโฟลเดอร์สำรอง';
 const show=text=>{status=text;onStatus(text);};
 async function load(){const s=getStore();if(!s?.local)return null;if(loadedFor!==s){folder=await s.getBackupFolder();loadedFor=s;lastRevision=undefined;}return s;}
 async function canWrite(){return !!folder&&await folder.queryPermission({mode:'readwrite'})==='granted';}
 async function writeFile(name,text){const handle=await folder.getFileHandle(name,{create:true}),w=await handle.createWritable();try{await w.write(text);await w.close();}catch(e){try{await w.abort();}catch{}throw e;}}
 function run(task){const job=queue.then(task);queue=job.catch(()=>{});return job;}
 async function flush(){return run(async()=>{const s=await load();if(!s)return;const state=await s.status();if(!folder){show('สำเนาในเบราว์เซอร์พร้อม · ยังไม่ได้ตั้งค่าโฟลเดอร์ไฟล์');return;}if(!await canWrite()){show('สำเนาในเบราว์เซอร์พร้อม · ต้องอนุญาตโฟลเดอร์อีกครั้ง');return;}if(state.revision===lastRevision){onStatus(status);return;}const saved=await s.exportBackup();await writeFile('LAYA_Backup_Automatic.json',saved.text);await s.markBackup(saved.revision);lastRevision=saved.revision;show('สำรองไฟล์อัตโนมัติแล้ว · '+folder.name+' · '+new Date().toLocaleTimeString('th-TH'));});}
 function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;flush().catch(()=>show('สำเนาในเบราว์เซอร์พร้อม · เขียนไฟล์โฟลเดอร์ไม่สำเร็จ'));},500);}
 async function setup(){try{const s=getStore();if(!s?.local)return;await load();if(folder&&await folder.requestPermission({mode:'readwrite'})==='granted'){lastRevision=undefined;await flush();return;}if(!window.showDirectoryPicker)throw new Error('ตั้งค่าโฟลเดอร์ด้วย Chrome หรือ Edge บนโน้ตบุ๊ก');const selected=await window.showDirectoryPicker({id:'laya-breakfast-backup',mode:'readwrite'});if(await selected.requestPermission({mode:'readwrite'})!=='granted')throw new Error('ยังไม่ได้อนุญาตให้เขียนไฟล์');await s.setBackupFolder(selected);folder=selected;lastRevision=undefined;await flush();notify('ตั้งค่าแล้ว ระบบสำรองไฟล์ให้อัตโนมัติ');}catch(e){if(e.name!=='AbortError')notify(e.message||'ตั้งค่าโฟลเดอร์ไม่สำเร็จ',true);}}
 async function archive(saved,label){return run(async()=>{await load();const name='LAYA_Before_'+label+'_'+Date.now()+'.json';if(await canWrite()){await writeFile(name,saved.text);return 'folder';}download(saved.text,name);return 'download';});}
 document.querySelector('#setup-backup-folder').addEventListener('click',setup);
 window.addEventListener('focus',schedule);
 return {schedule,flush,archive};
}
