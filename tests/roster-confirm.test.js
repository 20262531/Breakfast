import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmRoom} from '../domain.js';
import {webcrypto} from 'node:crypto';
globalThis.crypto ??= webcrypto;
test('manual confirmation changes only the selected room, keeps previous snapshot and events',()=>{
 const day={rooms:{'2210':{room:'2210',names:['Old Guest'],pax:0,pkg:'REVIEW',detectedPkg:'RB'},'2209':{room:'2209',names:['Other'],pax:1,pkg:'RB'}}};
 const previous=structuredClone(day.rooms['2210']);const {before,after}=confirmRoom(day,'2210',{names:'Roman\nEmilia',pax:2,pkg:'RB'},previous,'staff');
 assert.deepEqual(before,previous);assert.deepEqual(after.names,['Roman','Emilia']);assert.equal(after.pkg,'RB');assert.equal(day.rooms['2209'].names[0],'Other');assert.equal(after.manualConfirmed,true);
 assert.throws(()=>confirmRoom(day,'2210',{names:'Another',pax:2,pkg:'RO'},previous,'staff'),/เปลี่ยน/);
});
test('confirmation rejects missing package or invalid count',()=>{
 const day={rooms:{'2210':{room:'2210',names:['A'],pax:0,pkg:'REVIEW'}}};let old=structuredClone(day.rooms['2210']);
 assert.throws(()=>confirmRoom(day,'2210',{names:'A',pax:1,pkg:''},old,'staff'));
 assert.throws(()=>confirmRoom(day,'2210',{names:'A',pax:0,pkg:'RB'},old,'staff'));
});
