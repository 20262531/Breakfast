# LAYA Breakfast Check-in — คู่มือติดตั้ง v1.0

เว็บแอปสำหรับ GitHub Pages + Firebase Authentication + Cloud Firestore
ไม่มีขั้นตอน build และไม่ต้องติดตั้ง Node.js เพื่อใช้งานจริง

## 1. ทดลองหน้าจอก่อน

อัปโหลดไฟล์ขึ้น GitHub Pages ตามข้อ 4 แล้วเปิดเว็บไซต์ กด **ทดลองใช้งานด้วยข้อมูลสมมติ**

- 1101: RB 2 คน
- 2203: RO 3 คน
- 5102: RB 2 คน (ตึก D)

โหมดทดลองไม่เชื่อม Firebase ข้อมูลเก็บใน sessionStorage ของแท็บนั้นและแยกจากข้อมูลจริง
โหมดจริงต้องมีอินเทอร์เน็ตและเข้าสู่ระบบ ไม่มีการรับรายการค้างเพื่อส่งทีหลัง
อย่าเปิด index.html ด้วยการดับเบิลคลิก เพราะ JavaScript modules ต้องเปิดผ่านเว็บเซิร์ฟเวอร์

## 2. สร้าง Firebase

1. เปิด https://console.firebase.google.com/ แล้วสร้างหรือเลือกโปรเจกต์
2. ใน Project settings > General เพิ่มแอปแบบ Web (ไอคอน </>)
3. คัดลอกค่า firebaseConfig มาใส่ในไฟล์ `firebase-config.js` โดยคงรูปแบบ `export const firebaseConfig = {...};`

```js
export const firebaseConfig = {
  apiKey: "ค่าจาก Firebase",
  authDomain: "ชื่อโปรเจกต์.firebaseapp.com",
  projectId: "ชื่อโปรเจกต์",
  storageBucket: "ค่าจาก Firebase",
  messagingSenderId: "ค่าจาก Firebase",
  appId: "ค่าจาก Firebase"
};
```

ใช้ config ของ Web App เท่านั้น ไม่ใช้ service account, private key หรือรหัสผ่านผู้ดูแลในไฟล์

4. ไปที่ Build > Authentication > Sign-in method เปิด Email/Password
5. ไปที่ Authentication > Users > Add user สร้างอีเมล/รหัสผ่านของพนักงานและผู้ดูแล จด UID ของแต่ละคน
6. ไปที่ Authentication > Settings > Authorized domains เพิ่ม `ชื่อบัญชี.github.io` (ไม่ใส่ https:// หรือชื่อ repository)
7. ไปที่ Build > Firestore Database สร้างฐานข้อมูล **Cloud Firestore แบบ Standard / Native** ใช้ database `(default)` และเลือก region ที่เหมาะสม เช่น Singapore หากมีให้เลือก
8. ในแท็บ Rules แทนที่ข้อความทั้งหมดด้วยเนื้อหา `firestore.rules` แล้วกด Publish
9. ในแท็บ Data สร้าง collection `users` และ document ID เท่ากับ UID ของผู้ใช้แต่ละคน

| Field | Type | Value |
| --- | --- | --- |
| enabled | boolean | true |
| role | string | admin หรือ staff |

ต้องใส่ enabled เป็น boolean ไม่ใช่ string "true"

**admin** นำเข้ารายงาน รับลูกค้า และดูประวัติได้
**staff** รับลูกค้าและดูประวัติได้ แต่แก้รายงานผู้พักไม่ได้
สร้างหรือแก้สิทธิ์ users ผ่าน Firebase Console เท่านั้น เว็บไม่มีระบบเปิดสมัครเอง
ถ้าต้องการระงับผู้ใช้ ให้ตั้ง enabled เป็น false

## 3. ไฟล์ที่ต้องตั้งค่า

- `firebase-config.js`: ใส่ Web App config ของโรงแรม
- `firestore.rules`: คัดลอกเข้า Firestore Console แล้ว Publish

ไม่ต้องมี Firebase Storage, Cloud Functions หรือ Realtime Database สำหรับรุ่นนี้
ข้อมูลผู้พักที่อ่านจากไฟล์จะบันทึกลง Firestore ส่วนไฟล์ต้นฉบับไม่ถูกอัปโหลดเก็บไว้
การใช้งานอยู่ภายใต้โควตา/ค่าใช้จ่ายของโปรเจกต์ Firebase ของคุณ

## 4. อัปโหลด GitHub Pages

1. แตก ZIP แล้วเปิดโฟลเดอร์ `laya-breakfast`
2. สร้าง repository บน GitHub เช่น `laya-breakfast` (ใช้ Public หากบัญชีของคุณใช้ Pages กับ private repository ไม่ได้)
3. เลือก Add file > Upload files แล้วอัปโหลด **ไฟล์ภายในโฟลเดอร์** ให้ `index.html` อยู่ที่ root ของ repository
4. Commit changes
5. ไปที่ Settings > Pages > Build and deployment
6. Source เลือก Deploy from a branch
7. Branch เลือก main และโฟลเดอร์ /(root) แล้ว Save
8. รอให้ GitHub แสดง URL เช่น `https://ชื่อบัญชี.github.io/laya-breakfast/`
9. เปิด URL แล้วเข้าสู่ระบบด้วยบัญชี Firebase ที่สร้างไว้

ทั้งหมดใช้ relative paths จึงรองรับชื่อ repository ใดก็ได้
ไฟล์ `.nojekyll` ช่วยให้ Pages ส่งไฟล์ static โดยตรง หากอัปโหลดผ่านเว็บไม่ได้ก็ไม่กระทบแอปชุดนี้
**อย่าอัปโหลดไฟล์รายงานแขกจริงเข้า repository** ให้ใช้เมนูนำเข้าข้อมูลภายในแอปหลังเข้าสู่ระบบ

## 5. นำเข้ารายงานประจำวัน

ล็อกอิน admin > นำเข้ารายวัน > เลือกวันที่ > เลือกไฟล์ > จับคู่คอลัมน์ > ตรวจสอบข้อมูล > ยืนยัน

รองรับ CSV UTF-8, TSV, XLSX และ XLS (แผ่นงานแรก) ขนาดไม่เกิน 5 MB
แถวแรกต้องเป็นหัวคอลัมน์ หากรายงานมีหัวกระดาษหลายแถว ให้ลบออกก่อน
ชื่อคอลัมน์ไม่จำเป็นต้องตรง เพราะเลือกจับคู่ในหน้าจอได้
คอลัมน์มาตรฐานและไฟล์ตัวอย่าง:

```csv
Room,Guest Name,Pax,Package
1101,Anna Wilson,2,RB
2203,Li Wei,3,RO
5102,Alex Ivanov,2,RB
```

รูปแบบข้อมูล:

- **หนึ่งแถวต่อห้อง**: ช่อง Pax คือจำนวนผู้พักทั้งหมดของห้องนั้น เลขห้องต้องไม่ซ้ำ ชื่อหลายคนรวมในเซลล์ได้
- **หนึ่งแถวต่อแขก**: ระบบนับหนึ่งแถวเป็นหนึ่งคน รวมชื่อและจำนวนตามห้อง ไม่ใช้คอลัมน์ Pax ชื่อซ้ำในห้องเดียวกันถูกแจ้งให้ตรวจสอบก่อน หากแขกจริงชื่อเหมือนกันให้เปลี่ยนมาใช้หนึ่งแถวต่อห้อง
- หากผู้ใหญ่และเด็กอยู่คนละคอลัมน์ ให้รวมยอดเป็น Pax ก่อนนำเข้า รุ่นนี้นับรวมทุกคน ไม่แยกราคา/สิทธิ์เด็ก
- รองรับเลขห้อง 1101 หรือ A101, B203, C105, D102 และแปลงเป็นเลข 4 หลัก
- ตึก 1=A, 2=B, 3=C, 5=D; เลข 4 ใช้เป็นเลขชั้นหรือเลขห้องได้ แต่ไม่ใช่เลขตึก
- RO / Room Only / OTARO / OTARO* = ต้องชำระ, RB / Room + Breakfast = รวมอาหารเช้า
- ช่องว่าง, GROUP, HB, FB, AI, Executive หรือแพ็กเกจที่ไม่ชัดเจนจะถูกแจ้งให้ตรวจ ไม่เดาเป็น RB
- หากห้องเดียวกันมี RO และ RB จะไม่ให้ยืนยัน ต้องตรวจสิทธิ์รายห้องก่อน
- หน้าตัวอย่างแสดง 20 ห้อง แต่บันทึกทุกห้องที่ผ่านการตรวจ
- หากพบข้อผิดพลาดต้องแก้ในไฟล์ต้นฉบับแล้วเลือกไฟล์ใหม่
- รองรับข้อมูลรายวันสูงสุด 1,500 ห้อง และเนื้อหาห้องไม่เกิน 700 KB
- นำเข้าซ้ำวันที่เดิมจะ **แทนที่รายชื่อประจำวัน** แต่คงประวัติและจำนวนเข้าทานทั้งหมดไว้ ห้องที่ไม่อยู่ในไฟล์ใหม่จะค้นหาไม่ได้
- ยังไม่รองรับไฟล์ PDF และยังไม่ได้ปรับตัวอ่านให้ตรงกับรายงาน PMS ของโรงแรมโดยเฉพาะ ส่งตัวอย่างรายงานเพื่อปรับได้

## 6. การรับลูกค้า

1. พนักงานกรอกเลขห้องแล้ว Enter
2. ตรวจชื่อและแพ็กเกจกับลูกค้า
3. ใส่จำนวนคนที่เข้ามาจริง (ไม่จำเป็นต้องมาพร้อมกัน)
4. RB กดบันทึกเข้าทานได้เลย
5. RO ใส่ **ยอดเงินที่รับจริงรวมทั้งกลุ่ม** เลือกเงินสด/บัตรเครดิต/โอนเงิน และติ๊กได้รับชำระแล้วก่อนบันทึก
6. บันทึกสำเร็จ ช่องเลขห้องจะว่างและพร้อมรับห้องถัดไป

แอปบันทึกการยืนยันรับเงินโดยพนักงาน ไม่ได้เชื่อม payment gateway หรือยืนยันยอดธนาคารอัตโนมัติ
ไม่กำหนดราคาขายอัตโนมัติ เพราะยังไม่ได้รับราคาผู้ใหญ่/เด็กจากโรงแรม
กรณีไม่พบห้อง จะไม่สร้างรายการและให้ตรวจสอบกับ FO ก่อน

Firebase transaction อัปเดตจำนวนและประวัติพร้อมกัน เมื่อมีหลายเครื่องบันทึกห้องเดียวกัน ระบบอ่านยอดล่าสุดและปฏิเสธรายการที่เกินจำนวนผู้พัก
ใช้ event ID เดิมในการลองซ้ำของแบบฟอร์มเดียวกัน เพื่อป้องกันบันทึกซ้ำจากการกดส่งซ้ำ
Firestore Rules ตรวจจำนวนและเงื่อนไขรับชำระซ้ำอีกชั้นที่ฐานข้อมูล

ข้อมูลรายวันใช้เวลา Asia/Bangkok เปลี่ยนวันอัตโนมัติเมื่อข้ามเที่ยงคืน ประวัติเดิมยังอยู่
หากพักแท็บไว้ ให้กลับมาแล้วค้นหาเลขห้องใหม่ ข้อมูลวันเก่าไม่ถูกนำมาให้สิทธิ์ของวันใหม่

## 7. รายงาน

เมนูประวัติ / รายงาน เลือกวันที่และตึก A–D แล้วส่งออก CSV เปิดด้วย Excel ได้ (UTF-8 BOM)
รายงานมีเวลาไทย ห้อง ตึก ชื่อ จำนวนคน แพ็กเกจ ยอดรับชำระ วิธีชำระ และอีเมลพนักงาน
ชื่อในรายงานเป็นชื่อผู้พักของห้อง ณ เวลาบันทึก ไม่ได้ระบุว่าผู้พักคนใดในห้องเป็นผู้เข้าทานรายบุคคล

รุ่นนี้เก็บประวัติแบบไม่ให้แก้/ลบผ่านหน้าเว็บ เพื่อคงหลักฐานการบันทึก ยังไม่มีขั้นตอนยกเลิกรายการผิดพร้อมอนุมัติจากหัวหน้า

## 8. โครงสร้างข้อมูล

- users/{Firebase UID}: enabled, role
- days/{YYYY-MM-DD}: rooms, version, uploadedAt, uploadedBy, startAt, endAt
- days/{date}/counts/{room}: count, lastEvent
- days/{date}/entries/{eventId}: room, names, pkg, pax, amount, method, staffUid, staffEmail, createdAt

amount เก็บเป็นจำนวนสตางค์ เช่น 90000 = 900.00 บาท

## 9. แก้ปัญหาเบื้องต้น

- **หน้าแจ้งยังไม่ตั้ง Firebase**: ตรวจ firebase-config.js แล้วอัปโหลดไฟล์ใหม่
- **บัญชียังไม่มีสิทธิ์**: ตรวจ users/{UID} และชนิดข้อมูล enabled/role
- **Missing or insufficient permissions**: Publish firestore.rules และตรวจ UID ตรงกับบัญชีที่ล็อกอิน
- **ค้นหาห้องไม่พบ**: ตรวจวันนำเข้าและตัวอย่างข้อมูล ต้องมีรายงานของวันนี้ตามเวลาไทย
- **โหลด Excel ไม่สำเร็จ**: ตรวจว่าอัปโหลดโฟลเดอร์ vendor ครบ หรือใช้ Save As CSV UTF-8 แล้วนำเข้า
- **บันทึกแล้วไม่สำเร็จ**: ตรวจอินเทอร์เน็ตและค้นหาใหม่เพื่ออ่านจำนวนล่าสุด
- **ตัวหนังสือไทยใน CSV อ่านไม่ออก**: บันทึกไฟล์เป็น CSV UTF-8

## 10. สำหรับผู้พัฒนา

เว็บใช้ ES modules และ Firebase SDK 12.19.0 จาก gstatic CDN; ตัวอ่าน Excel ใช้ SheetJS 0.20.3 ซึ่งแนบไว้ใน vendor พร้อมฟอนต์ไทยใน fonts
การทดสอบ domain: `npm test` (ต้องมี Node.js เฉพาะเมื่อจะรันทดสอบเอง)

เอกสารอ้างอิง:
- https://firebase.google.com/docs/web/alt-setup
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://docs.sheetjs.com/docs/getting-started/installation/standalone/
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
