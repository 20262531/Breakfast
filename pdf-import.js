// Coordinates are taken from each page's column headers, not a fixed text offset.
export function linesFromItems(items){
  const lines=[];for(const item of [...items].filter(x=>x.text.trim()).sort((a,b)=>a.y-b.y||a.x-b.x)){
    let line=lines.at(-1);if(!line||Math.abs(line.y-item.y)>1.8){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);
  }for(const line of lines){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(x=>x.text).join(' ');}return lines;
}
function dateISO(s){const m=String(s).match(/^(\d{2})[-/](\d{2})[-/](\d{2}|\d{4})$/);return m?`${m[3].length===2?'20':''}${m[3]}-${m[2]}-${m[1]}`:null;}
export function packageTags(text){const result=[];for(const p of ['RO','RB'])if(new RegExp('(^|[^A-Z0-9])(?:\\d+\\s*)?R[ \t]*'+p[1]+'(?=$|[^A-Z0-9])','i').test(String(text)))result.push(p);return result;}
function rateHint(rate){if(/RO(?:F|\*)?$/i.test(rate))return 'RO';if(/RB\*?$/i.test(rate))return 'RB';return null;}
export function parseReportPages(pages,source){
  const records=[],dates=new Set(),errors=[],excluded=new Set();let current=null,commentSection=null,totals=null;
  for(let index=0;index<pages.length;index++){
    const lines=linesFromItems(pages[index]);const header=lines.find(l=>l.items.some(x=>x.text==='Name')&&l.items.some(x=>x.text==='Adl.'));
    if(!header){errors.push(`หน้า ${index+1}: ไม่พบหัวตาราง Guests INH`);continue;}
    for(const l of lines.filter(x=>x.y<header.y-20))for(const x of l.items){const date=dateISO(x.text);if(date)dates.add(date);}
    const positions={};for(const key of ['Name','Company','Arr.','Dep.','Adl.','Chl.','Pay','Rate'])positions[key]=header.items.find(x=>x.text===key)?.x;
    positions.Room=header.items.find(x=>x.text==='Room')?.x;
    if(Object.values(positions).some(x=>x===undefined)){errors.push(`หน้า ${index+1}: คอลัมน์ไม่ครบ`);continue;}
    const col=(line,start,end=Infinity)=>line.items.filter(x=>x.x>=start-1&&x.x<end-1).map(x=>x.text).join(' ').trim();
    const bodyTop=Math.max(header.y+12,...lines.filter(l=>l.y>header.y&&l.y<header.y+35&&l.items.some(x=>['No.','VIP','Block Code','Source','EDT'].includes(x.text))).map(l=>l.y))+2;
    const footer=lines.find(l=>l.y>header.y+30&&/^Filter\b/.test(l.text));
    for(const line of lines){
      if(line.y<bodyTop||(footer&&line.y>=footer.y))continue;
      if(/Total Rooms/.test(line.text)){
        const nums=line.items.filter(x=>/^\d+$/.test(x.text)).map(x=>Number(x.text));
        if(nums.length>=3)totals={rooms:nums[0],adults:nums.at(-2),children:nums.at(-1)};
        current=null;continue;
      }
      const roomItem=line.items.find(x=>Math.abs(x.x-positions.Room)<3&&/^\d{4}$/.test(x.text));
      if(roomItem){
        const room=roomItem.text,name=col(line,positions.Name,positions.Company).replace(/^\*+/,'').trim();
        const adultText=col(line,positions['Adl.'],positions['Chl.']),childText=col(line,positions['Chl.'],positions.Pay);
        const datesInRow=col(line,positions['Arr.'],positions['Adl.']).match(/\d{2}[-/]\d{2}[-/]\d{2,4}/g)||[];
        const record={room,name,adults:Number(adultText),children:Number(childText),rate:col(line,positions.Rate),arrival:dateISO(datesInRow[0]),departure:dateISO(datesInRow[1]),source,page:index+1,lines:[{page:index+1,text:line.text}],evidence:[],issues:[]};
        if(!/^\d+$/.test(adultText)||!/^\d+$/.test(childText))record.issues.push('อ่าน Adl./Chl. ไม่ครบ');
        if(!name)record.issues.push('ไม่พบชื่อแขก');
        const hint=rateHint(record.rate);if(hint)record.evidence.push({kind:'Rate Code',pkg:hint,code:record.rate});
        records.push(record);current=record;commentSection=null;
        if(!/^[1235][1-9]\d{2}$/.test(room))excluded.add(room);
      }else if(current){
        const s=line.text;current.lines.push({page:index+1,text:s});
        if(!commentSection&&Math.abs(line.items[0].x-positions.Name)<3){const continuation=col(line,positions.Name,positions.Company);if(continuation)current.name+=' '+continuation;}
        const match=s.match(/(?:Res\.\s*Comments:\s*)?(Cashiering|Reservation|General)(?:\s|$)/i);
        if(/Profile Notes:/i.test(s)){commentSection=null;continue;}
        if(match)commentSection=match[1][0].toUpperCase()+match[1].slice(1).toLowerCase();
        if(commentSection){for(const pkg of packageTags(s))if(!current.evidence.some(x=>x.kind===commentSection&&x.pkg===pkg))current.evidence.push({kind:commentSection,pkg,text:s,page:index+1});}
      }
    }
  }
  const unique=new Set(records.map(r=>r.room));const adults=records.reduce((n,r)=>n+(Number.isFinite(r.adults)?r.adults:0),0),children=records.reduce((n,r)=>n+(Number.isFinite(r.children)?r.children:0),0);
  if(!records.length)errors.push('ไม่พบแถวข้อมูลห้อง ไม่รองรับ PDF สแกนเป็นภาพ');
  if(!totals)errors.push('ไม่พบยอดรวมท้ายรายงาน จึงตรวจความครบถ้วนไม่ได้');
  else if(totals.rooms!==unique.size||totals.adults!==adults||totals.children!==children)errors.push(`ยอดอ่านไม่ตรงท้ายรายงาน: ห้อง ${unique.size}/${totals.rooms}, ผู้ใหญ่ ${adults}/${totals.adults}, เด็ก ${children}/${totals.children}`);
  return {source,records,dates:[...dates],totals,excluded:[...excluded],errors,pages:pages.length};
}
export function mergeReports(reports,serviceDate,rateMap={}){
  const rooms={};
  for(const report of reports)for(const record of report.records){
    if(!/^[1235][1-9]\d{2}$/.test(record.room))continue;
    const r=rooms[record.room]??={room:record.room,names:[],adults:0,children:0,pax:0,pkg:'REVIEW',rates:[],sources:[],lines:[],evidence:[],issues:[],_seen:new Set(),_sources:new Set()};
    const key=[record.name.toLowerCase(),record.arrival,record.departure,record.adults,record.children,record.rate].join('|');
    if(r._sources.size&&!r._sources.has(report.source))r.issues.push('ห้องเดียวกันปรากฏในหลายไฟล์ กรุณาตรวจว่าซ้ำหรือคนละการจอง');
    r._sources.add(report.source);
    if(!r._seen.has(key)){r._seen.add(key);if(!r.names.includes(record.name))r.names.push(record.name);r.adults+=Number.isFinite(record.adults)?record.adults:0;r.children+=Number.isFinite(record.children)?record.children:0;}
    else r.issues.push('พบแถวแขกซ้ำ ระบบไม่นับซ้ำ กรุณาตรวจ');
    r.lines.push(...(record.lines||[]).map(line=>({...line,source:report.source})));
    r.rates.push(record.rate);r.sources.push(`${report.source} · หน้า ${record.page}`);r.evidence.push(...record.evidence);
    if(rateMap[record.rate])r.evidence.push({kind:'รหัสที่ผู้ดูแลกำหนด',pkg:rateMap[record.rate],code:record.rate});
    r.issues.push(...record.issues);
    if(!record.arrival||!record.departure)r.issues.push('อ่านวันเข้าพัก/ออกไม่ครบ');
    else if(serviceDate<record.arrival||serviceDate>record.departure)r.issues.push('วันที่บริการอยู่นอกช่วงพักในรายงาน');
  }
  for(const r of Object.values(rooms)){
    r.pax=r.adults+r.children;const choices=new Set(r.evidence.map(e=>e.pkg));
    if(!choices.size)r.issues.push('ยังไม่มีหลักฐาน RO/RB กรุณาตรวจ Rate Code กับ FO');
    if(choices.size>1)r.issues.push('หลักฐาน RO และ RB ขัดกัน');
    if(r.pax<1||r.pax>50)r.issues.push('จำนวนผู้พักเป็น 0 หรือเกิน 50');
    if(r.names.length>r.pax)r.issues.push('จำนวนชื่อมากกว่า Adl.+Chl. กรุณายืนยันจำนวนที่ถูกต้อง');
    r.issues=[...new Set(r.issues)];r.rates=[...new Set(r.rates)];r.sources=[...new Set(r.sources)];
    r.evidence=[...new Map(r.evidence.map(e=>[JSON.stringify(e),e])).values()];
    r.detectedPkg=choices.size===1?[...choices][0]:null;r.pkg=r.issues.length?'REVIEW':r.detectedPkg;r.reviewReason='';
    delete r._seen;delete r._sources;
  }return rooms;
}
export async function readGuestPDF(file,onProgress=()=>{}){
  if(file.size>20*1024*1024)throw new Error('PDF ต้องไม่เกิน 20 MB ต่อไฟล์');
  if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
  const lib=await import('./vendor/pdfjs/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;
  try{if(pdf.numPages>150)throw new Error('PDF ต้องไม่เกิน 150 หน้า');const pages=[];
    for(let n=1;n<=pdf.numPages;n++){onProgress(n,pdf.numPages);const page=await pdf.getPage(n);const content=await page.getTextContent();const height=page.getViewport({scale:1}).height;pages.push(content.items.filter(x=>typeof x.str==='string').map(x=>({text:x.str,x:x.transform[4],y:height-x.transform[5],width:x.width})));page.cleanup();}
    return parseReportPages(pages,file.name);
  }finally{await pdf.destroy();}
}
