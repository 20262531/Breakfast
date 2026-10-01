# เชื่อม Firebase: radisson-1040d

ใส่ Web config ที่ได้รับแล้วใน firebase-config.js แอปใช้ Firebase Authentication และ Cloud Firestore ฐานข้อมูล (default)
measurementId เก็บตาม config แต่แอปไม่ได้เปิดใช้งาน Analytics
ยังไม่ได้เปลี่ยนการตั้งค่าใน Firebase Console หรือทดสอบเข้าสู่ระบบจริง

## อัปเดตเว็บ

หากใช้ v1.3 แล้ว อัปโหลดเฉพาะ firebase-config.js ทับไฟล์เดิมใน GitHub และรอ Pages อัปเดต
หากติดตั้งใหม่ อัปโหลดไฟล์ภายใน laya-breakfast ให้ index.html อยู่ที่ root

## บัญชีและฐานข้อมูล

1. ใน Firebase Console เลือกโปรเจกต์ radisson-1040d
2. Authentication > Sign-in method เปิด Email/Password แล้ว Save
3. Authentication > Users > Add user สร้างบัญชีผู้ดูแล เก็บรหัสผ่านไว้กับตัวเอง และคัดลอก UID
4. Firestore Database สร้างฐานข้อมูล (default) แบบ Standard/Native หากยังไม่มี
5. ถ้าโปรเจกต์นี้ยังไม่ใช้กับแอปอื่น ให้คัดลอก firestore.rules ไปที่ Rules แล้ว Publish
   ถ้ามีแอปอื่นใช้อยู่ ให้รวมกฎกับกฎเดิมก่อน ไม่แทนที่ทั้งหมด เพราะอาจกระทบแอปอื่น
   แอปนี้ใช้ users, days, settings/breakfastRateCodes จึงต้องตรวจว่าชื่อเหล่านี้ไม่ชนข้อมูลเดิม
6. ใน Firestore > Data สร้าง users/{UID} โดย document ID เป็น UID จาก Authentication
   - enabled: boolean = true
   - role: string = admin (พนักงานทั่วไปใช้ staff)
7. เข้าสู่เว็บด้วยอีเมลและรหัสผ่านบัญชีนี้ ผู้ดูแลนำเข้ารายวันได้ พนักงานรับลูกค้าได้

หากขึ้นว่าบัญชียังไม่ได้รับสิทธิ์ ตรวจ document ID, enabled แบบ boolean และ role
หากขึ้น Missing or insufficient permissions ตรวจ Rules และสิทธิ์ users
ห้ามใช้กฎ allow read, write: if true กับข้อมูลแขก

เอกสารอ้างอิง:
https://firebase.google.com/docs/auth/web/password-auth
https://firebase.google.com/docs/firestore/security/get-started
