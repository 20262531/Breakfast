import {buildings} from './domain.js';
export const eventRoom=e=>e.pkg==='WALKIN'?'Walk-in':e.room;
export const eventBuilding=e=>e.pkg==='WALKIN'?'Phase '+e.phase:buildings[e.room[0]];
export const phaseDefinitions=[{id:1,title:'Phase 1',label:'ตึก A / B / C (1 / 2 / 3)',digits:['1','2','3']},{id:2,title:'Phase 2',label:'ตึก D (5)',digits:['5']}];
export function splitPhaseReports(state,date){
 return phaseDefinitions.map(phase=>{
  const events=(state.events||[]).filter(e=>e.pkg==='WALKIN'?e.phase===phase.id:phase.digits.includes(e.room[0])).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  const rooms=Object.values(state.day?.rooms||{}).filter(r=>phase.digits.includes(r.room[0]));
  const total=list=>({pax:list.reduce((n,e)=>n+e.pax,0),rb:list.filter(e=>e.pkg==='RB').reduce((n,e)=>n+e.pax,0),ro:list.filter(e=>e.pkg==='RO').reduce((n,e)=>n+e.pax,0),amount:list.reduce((n,e)=>n+e.amount,0),pendingPax:list.filter(e=>e.paymentStatus==='pending').reduce((n,e)=>n+e.pax,0),dueAmount:list.filter(e=>e.paymentStatus==='pending').reduce((n,e)=>n+e.dueAmount,0),roPaid:list.filter(e=>e.pkg==='RO'&&e.paymentStatus!=='pending').reduce((n,e)=>n+e.pax,0),walkin:list.filter(e=>e.pkg==='WALKIN').reduce((n,e)=>n+e.pax,0),walkinPaid:list.filter(e=>e.pkg==='WALKIN'&&e.paymentStatus!=='pending').reduce((n,e)=>n+e.pax,0),walkinPending:list.filter(e=>e.pkg==='WALKIN'&&e.paymentStatus==='pending').reduce((n,e)=>n+e.pax,0),enteredRooms:new Set(list.filter(e=>e.pkg!=='WALKIN').map(e=>e.room)).size});
  return {...phase,date,hasRoster:!!state.day&&!state.day.walkinOnly,events,...total(events),rosterRooms:rooms.length,rosterPax:rooms.reduce((n,r)=>n+r.pax,0),methods:Object.fromEntries(['cash','card','transfer'].map(m=>[m,events.filter(e=>e.method===m).reduce((n,e)=>n+e.amount,0)])),buildings:phase.digits.map(d=>{const list=events.filter(e=>e.pkg!=='WALKIN'&&e.room[0]===d),roster=rooms.filter(r=>r.room[0]===d);return {name:buildings[d],rosterRooms:roster.length,rosterPax:roster.reduce((n,r)=>n+r.pax,0),...total(list)};})};
 });
}
export function phaseSheetRows(report,formatTime){
 const r=report;
 const header=['เวลา (ไทย)','เลขห้อง','ตึก','ชื่อแขก','จำนวนคน','สิทธิ์','รับเงิน (บาท)','วิธีชำระ','ผู้บันทึก','สถานะชำระ','ยอดค้าง (บาท)','เวลารับเงิน (ไทย)'];
 const methods={cash:'เงินสด',card:'บัตรเครดิต',transfer:'โอนเงิน'};
 return [['LAYA Breakfast Report'],[r.title,r.label],['วันที่บริการ',r.date],[],['ห้องพักตามรายงาน',r.hasRoster?r.rosterRooms:'ยังไม่มีรายงานนำเข้า'],['ผู้พักตามรายงาน (คน)',r.hasRoster?r.rosterPax:'ยังไม่มีรายงานนำเข้า'],['ห้องที่เข้าทาน',r.enteredRooms],['เข้าทานทั้งหมด (คน)',r.pax],['RB (คน)',r.rb],['RO ชำระแล้ว (คน)',r.roPaid],['ยอดรับเงินทั้งหมด (บาท)',r.amount/100],['เงินสด / บัตร / โอน (บาท)',r.methods.cash/100,r.methods.card/100,r.methods.transfer/100],['รอชำระทั้งหมด (คน) / ยอดค้าง (บาท)',r.pendingPax,r.dueAmount/100],['รายละเอียดการเข้าทาน'],header,...r.events.map(e=>[formatTime(e.createdAt),eventRoom(e),eventBuilding(e),e.names.join(' / '),e.pax,e.pkg,e.amount/100,methods[e.method]||'',e.staffEmail,e.paymentStatus==='pending'?'รอชำระ':e.pkg!=='RB'?'ชำระแล้ว':'รวมอาหารเช้า',(e.dueAmount||0)/100,e.settledAt?formatTime(e.settledAt):e.pkg!=='RB'&&e.paymentStatus!=='pending'?formatTime(e.createdAt):'']),[],['Walk-in รวม (คน)',r.walkin],['Walk-in ชำระแล้ว (คน)',r.walkinPaid],['Walk-in รอชำระ (คน)',r.walkinPending]];
}
