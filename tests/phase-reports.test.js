import test from 'node:test';
import assert from 'node:assert/strict';
import {splitPhaseReports,phaseSheetRows} from '../phase-reports.js';
test('phase reports reconcile covers/payments and preserve split visits without counting rooms twice',()=>{
 const e=(room,pax,pkg,amount=0,method='')=>({room,pax,pkg,amount,method,names:['Test'],staffEmail:'Staff',createdAt:'2026-10-01T01:00:00Z'});
 const state={day:{rooms:{a:{room:'1101',pax:4},b:{room:'2203',pax:2},c:{room:'3105',pax:1},d:{room:'5102',pax:3},pm:{room:'9000',pax:99}}},events:[e('1101',1,'RB'),e('1101',2,'RB'),e('2203',2,'RO',60000,'cash'),e('3105',1,'RB'),e('5102',1,'RO',30000,'card'),e('5102',2,'RB')]};
 const [a,b]=splitPhaseReports(state,'2026-10-01');
 assert.equal(a.rosterRooms,3);assert.equal(a.rosterPax,7);assert.equal(a.pax,6);assert.equal(a.enteredRooms,3);assert.equal(a.rb,4);assert.equal(a.ro,2);assert.equal(a.amount,60000);
 assert.equal(b.rosterRooms,1);assert.equal(b.rosterPax,3);assert.equal(b.pax,3);assert.equal(b.enteredRooms,1);assert.equal(b.amount,30000);assert.equal(b.methods.card,30000);
 assert.equal(a.pax+b.pax,9);assert.equal(a.amount+b.amount,90000);assert.equal(a.events.length+b.events.length,6);assert.ok(b.events.every(e=>e.room[0]==='5'));
 assert.equal(phaseSheetRows(b,()=> '08:00')[14][4],'จำนวนคน');assert.equal(phaseSheetRows(b,()=> '08:00')[15][6],300);
});
test('empty reports keep both phases and distinguish missing roster from zero occupancy',()=>{
 const reports=splitPhaseReports({events:[]},'2026-10-01');assert.equal(reports.length,2);assert.equal(reports[0].pax,0);assert.equal(reports[1].hasRoster,false);assert.equal(phaseSheetRows(reports[1],()=> '')[4][1],'ยังไม่มีรายงานนำเข้า');
});
