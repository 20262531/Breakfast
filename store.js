import {today,validateEntry} from './domain.js';
export function demoStore(){
  let rateRules={mapping:{},version:null};let data={};try{data=JSON.parse(sessionStorage.getItem('laya-breakfast-demo-v1')||'{}');}catch{}
  const d=today();if(!data[d])data[d]={day:{version:'demo',uploadedBy:'demo',rooms:{'1101':{room:'1101',names:['Anna Wilson'],pax:2,pkg:'RB'},'2203':{room:'2203',names:['Li Wei'],pax:3,pkg:'RO'},'5102':{room:'5102',names:['Alex Ivanov'],pax:2,pkg:'RB'}}},counts:{},events:[]};
  const listeners=new Set();const persist=()=>{sessionStorage.setItem('laya-breakfast-demo-v1',JSON.stringify(data));listeners.forEach(f=>f());};
  return {user:{uid:'demo',email:'demo@laya.local',role:'admin'},demo:true,
    watch(date,cb){const f=()=>{const x=data[date]||{};cb({day:x.day||null,counts:x.counts||{},events:x.events||[],fresh:true});};listeners.add(f);f();return()=>listeners.delete(f);},
    async importDay(date,rooms,version){const x=data[date]||{counts:{},events:[]};if((x.day?.version||null)!==version)throw new Error('มีการอัปโหลดข้อมูลใหม่จากเครื่องอื่น กรุณาตรวจใหม่');x.day={rooms,version:crypto.randomUUID(),uploadedBy:'demo',uploadedAt:new Date().toISOString()};data[date]=x;persist();},
    async checkin(date,room,pax,amount,method,id,expected){if(date!==today())throw new Error('เปลี่ยนวันแล้ว กรุณาค้นหาใหม่');const x=data[date];if(x.events.some(e=>e.id===id))return;const r=x?.day?.rooms[room];if(JSON.stringify(r)!==JSON.stringify(expected))throw new Error('ข้อมูลห้องเปลี่ยน กรุณาค้นหาใหม่');const count=x.counts[room]?.count||0;validateEntry(r,count,pax,amount,method);x.counts[room]={count:count+pax};x.events.push({id,room,names:r.names,pkg:r.pkg,pax,amount,method,staffEmail:'demo@laya.local',createdAt:new Date().toISOString()});persist();},
    async getRateRules(){return structuredClone(rateRules);},async saveRateRules(mapping,version){if(version!==rateRules.version)throw new Error('มีผู้แก้รหัสใหม่ กรุณาโหลดใหม่');rateRules={mapping,version:crypto.randomUUID()};},async getDay(date){return data[date]?.day||null;},async logout(){}}
}
export async function firebaseStore(config,onAuth,onError){
  const base='https://www.gstatic.com/firebasejs/12.19.0/';
  const [a,f,authLib]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-firestore.js'),import(base+'firebase-auth.js')]);
  const app=a.initializeApp(config);const db=f.getFirestore(app);const auth=authLib.getAuth(app);await authLib.setPersistence(auth,authLib.browserSessionPersistence);
  let store=null,stopProfile=()=>{};
  authLib.onAuthStateChanged(auth,user=>{stopProfile();store=null;if(!user){onAuth(null);return;}
    stopProfile=f.onSnapshot(f.doc(db,'users',user.uid),snapshot=>{
      const profile=snapshot.data();if(!profile?.enabled||!['staff','admin'].includes(profile.role)){onAuth(null);onError(new Error('บัญชีนี้ยังไม่ได้รับสิทธิ์ กรุณาให้ผู้ดูแลเพิ่ม users/'+user.uid+' ใน Firestore'));return;}
      store={user:{uid:user.uid,email:user.email,role:profile.role},demo:false,
        watch(date,cb,error){let state={day:null,counts:{},events:[],fresh:false};const emit=()=>cb({...state});const ref=f.doc(db,'days',date);
          const unsubs=[f.onSnapshot(ref,{includeMetadataChanges:true},s=>{state.day=s.exists()?s.data():null;state.fresh=!s.metadata.fromCache;emit();},error),f.onSnapshot(f.collection(ref,'counts'),s=>{state.counts=Object.fromEntries(s.docs.map(x=>[x.id,x.data()]));emit();},error),f.onSnapshot(f.collection(ref,'entries'),s=>{state.events=s.docs.map(x=>({id:x.id,...x.data()}));emit();},error)];return()=>unsubs.forEach(x=>x());},
        async getRateRules(){const s=await f.getDocFromServer(f.doc(db,'settings','breakfastRateCodes'));return s.exists()?s.data():{mapping:{},version:null};},async saveRateRules(mapping,version){const ref=f.doc(db,'settings','breakfastRateCodes');await f.runTransaction(db,async tx=>{const s=await tx.get(ref);if((s.data()?.version||null)!==version)throw new Error('มีผู้แก้รหัสใหม่ กรุณาอ่าน PDF ใหม่');tx.set(ref,{mapping,version:crypto.randomUUID(),updatedBy:user.uid,updatedAt:f.serverTimestamp()});});},
        async getDay(date){const s=await f.getDocFromServer(f.doc(db,'days',date));return s.exists()?s.data():null;},
        async importDay(date,rooms,version){const ref=f.doc(db,'days',date);const start=new Date(date+'T00:00:00+07:00');await f.runTransaction(db,async tx=>{const old=await tx.get(ref);if((old.data()?.version||null)!==version)throw new Error('มีการอัปโหลดใหม่จากเครื่องอื่น กรุณาตรวจข้อมูลใหม่');tx.set(ref,{rooms,version:crypto.randomUUID(),uploadedAt:f.serverTimestamp(),uploadedBy:user.uid,startAt:f.Timestamp.fromDate(start),endAt:f.Timestamp.fromMillis(start.getTime()+86400000)});});},
        async checkin(date,room,pax,amount,method,id,expected){if(date!==today())throw new Error('เปลี่ยนวันแล้ว กรุณาค้นหาใหม่');const dayRef=f.doc(db,'days',date),countRef=f.doc(dayRef,'counts',room),entryRef=f.doc(dayRef,'entries',id);
          await f.runTransaction(db,async tx=>{const [day,count,entry]=await Promise.all([tx.get(dayRef),tx.get(countRef),tx.get(entryRef)]);if(entry.exists())return;const r=day.data()?.rooms[room];if(JSON.stringify(r?.names)!==JSON.stringify(expected.names)||r?.pkg!==expected.pkg||r?.pax!==expected.pax)throw new Error('ข้อมูลห้องเปลี่ยนหลังนำเข้า กรุณาค้นหาใหม่');const n=count.data()?.count||0;validateEntry(r,n,pax,amount,method);
            tx.set(countRef,{count:n+pax,lastEvent:id});tx.set(entryRef,{room,names:r.names,pkg:r.pkg,pax,amount,method,staffUid:user.uid,staffEmail:user.email,createdAt:f.serverTimestamp()});});},
        async logout(){await authLib.signOut(auth);}
      };onAuth(store);
    },onError);
  });
  return {login:(email,password)=>authLib.signInWithEmailAndPassword(auth,email,password),logout:()=>authLib.signOut(auth)};
}
