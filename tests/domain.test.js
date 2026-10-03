import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roomNumber,packageCode,parseCSV,buildRoster,validateEntry,csvString} from '../domain.js';
test('building conversion retains floor/room and rejects building 4',()=>{for(const [a,b] of [['A101','1101'],['B203','2203'],['C105','3105'],['D102','5102'],['5401','5401']])assert.equal(roomNumber(a),b);for(const s of ['4101','101','5001','1101x',''])assert.throws(()=>roomNumber(s));});
test('package classification never interprets GROUP as RO or missing as RB',()=>{for(const p of ['RO','OTARO','OTARO*','Room Only'])assert.equal(packageCode(p),'RO');assert.equal(packageCode('Room + Breakfast'),'RB');for(const p of ['GROUP','PROMO','', 'RO RB','HB'])assert.throws(()=>packageCode(p));});
test('CSV handles BOM, multiline quoted fields, CRLF and escaped quotes',()=>{assert.deepEqual(parseCSV('\uFEFFRoom,Name\r\n1101,"Anna, \"\"A\"\"\nWilson"'),[['Room','Name'],['1101','Anna, "A"\nWilson']]);assert.throws(()=>parseCSV('a,b\n1,"unfinished'));});
const map={room:0,name:1,pax:2,pkg:3};
test('room/guest imports protect against duplicate and conflicting packages',()=>{const rows=[['Room','Name','Pax','Package'],['A101','A',2,'RB'],['1101','B',2,'RB']];assert.equal(buildRoster(rows,map,'room').errors.length,0);assert.equal(buildRoster(rows,map,'room').rooms['1101'].pax,4);assert.equal(buildRoster(rows,map,'guest').rooms['1101'].pax,2);rows[2][3]='RO';assert.equal(buildRoster(rows,map,'guest').errors.length,1);rows[2]=['1101','A',2,'RB'];assert.equal(buildRoster(rows,map,'guest').errors.length,1);});
test('CSV imports exclude PM, POS, 9xxx and all buildings outside A-D before counting guests',()=>{
  const rows=[['Room','Name','Pax','Package'],['1101','Guest A',2,'RB'],['D102','Guest D',1,'RO'],['9000','PM',0,''],['9100','POS',0,''],['4111','Other tower',7,'RB'],['PM ROOM','Accounting',10,'']];
  const result=buildRoster(rows,map,'room');
  assert.deepEqual(Object.keys(result.rooms).sort(),['1101','5102']);
  assert.equal(Object.values(result.rooms).reduce((sum,room)=>sum+room.pax,0),3);
  assert.equal(result.skipped.length,4);
  assert.deepEqual(result.errors,[]);
});
test('a mistyped guest room remains an error, not a silently excluded accounting room',()=>{
  const result=buildRoster([['Room','Name','Pax','Package'],['110','Guest',2,'RB']],map,'room');
  assert.equal(result.skipped.length,0);assert.equal(result.errors.length,1);
});
test('entry validation permits occupancy overage and still requires RO payment',()=>{const r={pax:3,pkg:'RO'};validateEntry(r,1,2,50000,'cash');assert.doesNotThrow(()=>validateEntry(r,2,2,50000,'cash'));assert.throws(()=>validateEntry(r,0,1,0,'cash'));assert.throws(()=>validateEntry(r,0,1,50000,''));assert.throws(()=>validateEntry(r,0,1.5,50000,'cash'));});
test('CSV export neutralizes spreadsheet formula injection',()=>{assert.match(csvString([['=HYPERLINK("x")']]),/"'=HYPERLINK/);});
test('repeated spreadsheet rooms accumulate counts, while rejected rows cannot change prior totals',()=>{
 const rows=[['Room','Name','Pax','Package'],['D101','A',20,'RO'],['5101','B',25,'RO'],['5101','C',10,'RO']];const result=buildRoster(rows,map,'room');assert.equal(result.rooms['5101'].pax,45);assert.equal(result.rooms['5101'].names.length,2);assert.equal(result.errors.length,1);
});

test('actual covers may exceed reported occupancy, including completed rooms and large entries',()=>{const r={pax:2,pkg:'RB'};assert.doesNotThrow(()=>validateEntry(r,5,51,0,''));for(const n of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>validateEntry(r,0,n,0,''));assert.throws(()=>validateEntry(r,Number.MAX_SAFE_INTEGER,1,0,''));});
