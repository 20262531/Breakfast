export const buildings = {1:'A',2:'B',3:'C',5:'D'};
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function roomNumber(raw){
  let s=String(raw??'').trim().toUpperCase();
  const a=s.match(/^([ABCD])([1-9]\d{2})$/);
  if(a)s=({A:'1',B:'2',C:'3',D:'5'})[a[1]]+a[2];
  if(!/^[1235][1-9]\d{2}$/.test(s))throw new Error('เลขห้องต้องเป็น 4 หลัก ขึ้นต้นด้วย 1, 2, 3 หรือ 5 (หรือ A101–D999)');
  return s;
}
export function packageCode(raw){
  const s=String(raw??'').trim().toUpperCase();
  // Token boundaries deliberately exclude GROUP / PROMO / arbitrary text.
  const ro=/(^|[^A-Z0-9])(RO|OTARO\*?|ROOM\s*ONLY)(?=$|[^A-Z0-9])/.test(s);
  const rb=/(^|[^A-Z0-9])(RB|ROOM\s*\+\s*BREAKFAST)(?=$|[^A-Z0-9])/.test(s);
  if(ro===rb)throw new Error('แพ็กเกจไม่ชัดเจน ต้องระบุ RO หรือ RB');
  return ro?'RO':'RB';
}
export function parseCSV(text){
  text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/)[0];
  const sep=first.includes('\t')?'\t':first.split(';').length>first.split(',').length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=c;}
    else if(c===sep&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('เครื่องหมายคำพูดใน CSV ไม่ครบ');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function buildRoster(rows,map,mode){
  if(rows.length<2)throw new Error('ไม่พบข้อมูลในไฟล์');
  const rooms={},errors=[],skipped=[],seen=new Set();
  rows.slice(1).forEach((row,i)=>{
    if(!row.some(x=>String(x??'').trim()))return;
    try{
      const rawRoom=String(row[map.room]??'').trim().toUpperCase();
      // PM, POS and other accounting rooms are present in daily guest reports.
      // Still reject malformed values that look like a guest room (e.g. 110 or A10).
      if(rawRoom&&!/^[1235ABCD]/.test(rawRoom)){
        skipped.push({row:i+2,room:rawRoom});return;
      }
      const room=roomNumber(rawRoom);const name=String(row[map.name]??'').trim();
      if(!name||name.length>300)throw new Error('ชื่อแขกต้องมี 1–300 ตัวอักษร');
      const pkg=packageCode(row[map.pkg]);
      const pax=mode==='guest'?1:Number(row[map.pax]);
      if(!Number.isInteger(pax)||pax<1||pax>50)throw new Error('จำนวนผู้พักต้องเป็นจำนวนเต็ม 1–50');
      const prev=rooms[room];
      if(prev&&prev.pkg!==pkg)throw new Error('ห้องเดียวกันมี RO / RB ไม่ตรงกัน');
      const key=room+'|'+name.toLocaleLowerCase();
      if(mode==='guest'&&seen.has(key))throw new Error('ชื่อซ้ำในห้องเดียวกัน กรุณาตรวจต้นฉบับ');
      if(prev&&prev.pax+pax>50)throw new Error('จำนวนผู้พักรวมเกิน 50');
      seen.add(key);
      if(prev){if(!prev.names.includes(name))prev.names.push(name);prev.pax+=pax;}
      else rooms[room]={room,names:[name],pax,pkg};
    }catch(e){errors.push('แถว '+(i+2)+': '+e.message);}
  });
  if(Object.keys(rooms).length>1500)errors.push('รองรับไม่เกิน 1,500 ห้องต่อวัน');
  if(new TextEncoder().encode(JSON.stringify(rooms)).length>700000)errors.push('ข้อมูลเกินขนาด 700 KB กรุณาลดคอลัมน์ชื่อหรือแบ่งข้อมูล');
  return {rooms,errors,skipped};
}
export function validateEntry(room,count,pax,amount,method,paymentStatus='paid',dueAmount=0){
  if(!room)throw new Error('ไม่พบห้องในข้อมูลประจำวัน');
  if(!Number.isSafeInteger(pax)||pax<1||!Number.isSafeInteger(pax+count))throw new Error('จำนวนเข้าทานต้องเป็นจำนวนเต็มมากกว่า 0');
  if(paymentStatus==='paid'&&dueAmount!==0)throw new Error('ยอดค้างของรายการชำระแล้วต้องเป็นศูนย์');
  if(room.pkg==='RB'&&(amount!==0||method!==''))throw new Error('RB ต้องไม่มียอดรับชำระ');
  if(!['paid','pending'].includes(paymentStatus))throw new Error('สถานะรับเงินไม่ถูกต้อง');
  if(paymentStatus==='pending'&&(room.pkg!=='RO'||amount!==0||method!==''||!Number.isInteger(dueAmount)||dueAmount<=0||dueAmount>100000000))throw new Error('กรุณาระบุยอดค้างชำระของ RO');
  if(room.pkg==='RO'&&paymentStatus==='paid'&&(!Number.isInteger(amount)||amount<=0||amount>100000000||!['cash','card','transfer'].includes(method)))throw new Error('กรุณาระบุยอดรับชำระและวิธีชำระ');
  if(!['RO','RB'].includes(room.pkg))throw new Error('แพ็กเกจไม่ชัดเจน กรุณาตรวจรายงาน');
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function csvString(rows){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
export function makeWalkinEvent({id,name='',phase=1,pax,amount,method,paymentStatus='paid'},staffEmail){
 if(typeof id!=='string'||!id||id.length>200||![1,2].includes(phase)||typeof name!=='string'||name.length>300)throw new Error('ข้อมูล Walk-in ไม่ถูกต้อง');
 validateEntry({pkg:'RO'},0,pax,paymentStatus==='pending'?0:amount,paymentStatus==='pending'?'':method,paymentStatus,paymentStatus==='pending'?amount:0);
 return {id,room:'',names:[name.trim()||'Walk-in'],pkg:'WALKIN',phase,pax,amount:paymentStatus==='pending'?0:amount,method:paymentStatus==='pending'?'':method,paymentStatus,dueAmount:paymentStatus==='pending'?amount:0,staffEmail,createdAt:new Date().toISOString()};
}
export function auditChange(day,before,after,staffEmail,action){
 (day.audit??=[]).push({id:crypto.randomUUID(),eventId:before.id,action,at:new Date().toISOString(),staffEmail,before:structuredClone(before),after:after?structuredClone(after):null});
}
export function reviseEvent(day,id,input,expected,staffEmail,action='edit'){
 const index=day?.events.findIndex(e=>e.id===id);if(index===undefined||index<0)throw new Error('ไม่พบรายการ อาจถูกยกเลิกแล้ว');const old=day.events[index];
 if(JSON.stringify(old)!==JSON.stringify(expected))throw new Error('รายการเปลี่ยนแล้ว กรุณาปิดและเปิดแก้ไขใหม่');
 if(!['edit','cancel'].includes(action))throw new Error('คำสั่งไม่ถูกต้อง');let next=null;
 if(action==='edit'){
  if(old.pkg==='WALKIN')next=makeWalkinEvent({...input,id},old.staffEmail);
  else{const room=roomNumber(input.room),r=day.day.rooms[room];if(!r||!['RB','RO'].includes(r.pkg))throw new Error('ห้องใหม่ต้องมี RO/RB ที่ยืนยันแล้วในรายงานวันนั้น');const status=r.pkg==='RB'?'paid':input.paymentStatus;const pending=status==='pending';validateEntry(r,0,input.pax,r.pkg==='RB'||pending?0:input.amount,r.pkg==='RB'||pending?'':input.method,status,pending?input.amount:0);next={id,room,names:structuredClone(r.names),pkg:r.pkg,pax:input.pax,amount:r.pkg==='RB'||pending?0:input.amount,method:r.pkg==='RB'||pending?'':input.method,paymentStatus:status,dueAmount:pending?input.amount:0};}
  next={...next,createdAt:old.createdAt,staffEmail:old.staffEmail,updatedAt:new Date().toISOString(),updatedBy:staffEmail};
  if(next.pkg!=='RB'&&next.paymentStatus==='paid'){const unchanged=old.paymentStatus!=='pending'&&old.amount===next.amount&&old.method===next.method&&old.pkg===next.pkg;if(unchanged&&old.settledAt){next.settledAt=old.settledAt;next.settledBy=old.settledBy;}else if(!unchanged){next.settledAt=next.updatedAt;next.settledBy=staffEmail;}}
 }
 const events=day.events.filter((e,i)=>i!==index);if(next)events.splice(index,0,next);const counts={};for(const e of events)if(e.pkg!=='WALKIN'){const n=(counts[e.room]?.count||0)+e.pax;if(!Number.isSafeInteger(n))throw new Error('ยอดจำนวนคนเกินขนาด');counts[e.room]={count:n,lastEvent:e.id};}
 auditChange(day,old,next,staffEmail,action);day.events=events;day.counts=counts;return next;
}

// Manual roster confirmation is separate from check-in event changes.
export function confirmRoom(day,room,input,expected,staffEmail){
 const old=day?.rooms?.[room];if(!old||JSON.stringify(old)!==JSON.stringify(expected))throw new Error('ข้อมูลห้องถูกเปลี่ยน กรุณาค้นหาใหม่');
 if(!['RO','RB'].includes(input.pkg))throw new Error('กรุณาเลือก RO หรือ RB');
 const names=String(input.names||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
 if(!names.length||names.length>50||names.some(n=>n.length>300))throw new Error('กรุณาระบุชื่อแขก (สูงสุด 50 ชื่อ)');
 const pax=Number(input.pax);if(!Number.isInteger(pax)||pax<1||pax>50)throw new Error('จำนวนผู้พักต้องอยู่ระหว่าง 1–50');
 const after={...structuredClone(old),room,names,pax,pkg:input.pkg,manualConfirmed:true,confirmedAt:new Date().toISOString(),confirmedBy:staffEmail};
 day.rooms[room]=after;return {before:structuredClone(old),after:structuredClone(after)};
}
