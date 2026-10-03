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
  if(!Number.isInteger(pax)||pax<1||pax+count>room.pax)throw new Error('จำนวนเข้าทานเกินผู้พักหรือมีเครื่องอื่นบันทึกแล้ว กรุณาค้นหาใหม่');
  if(paymentStatus==='paid'&&dueAmount!==0)throw new Error('ยอดค้างของรายการชำระแล้วต้องเป็นศูนย์');
  if(room.pkg==='RB'&&(amount!==0||method!==''))throw new Error('RB ต้องไม่มียอดรับชำระ');
  if(!['paid','pending'].includes(paymentStatus))throw new Error('สถานะรับเงินไม่ถูกต้อง');
  if(paymentStatus==='pending'&&(room.pkg!=='RO'||amount!==0||method!==''||!Number.isInteger(dueAmount)||dueAmount<=0||dueAmount>100000000))throw new Error('กรุณาระบุยอดค้างชำระของ RO');
  if(room.pkg==='RO'&&paymentStatus==='paid'&&(!Number.isInteger(amount)||amount<=0||amount>100000000||!['cash','card','transfer'].includes(method)))throw new Error('กรุณาระบุยอดรับชำระและวิธีชำระ');
  if(!['RO','RB'].includes(room.pkg))throw new Error('แพ็กเกจไม่ชัดเจน กรุณาตรวจรายงาน');
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function csvString(rows){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
