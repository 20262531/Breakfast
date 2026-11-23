# เปิดใช้ OpenAI ใน Breakfast Check-in 2.14

ใช้ Node.js 22 ขึ้นไปบนโน้ตบุ๊กเครื่องที่รับแขก แอปใช้ OpenAI API ผ่านเซิร์ฟเวอร์ในเครื่อง
ตั้งค่า API key ของโปรเจกต์โรงแรมและเปิดการเรียกเก็บเงินหรือเครดิต API ใน [OpenAI Platform](https://platform.openai.com/api-keys)
ตาม [คู่มือ OpenAI](https://developers.openai.com/api/docs/quickstart)

1. แตก ZIP แล้วเปิด PowerShell ในโฟลเดอร์ที่มี `package.json`
2. คัดลอกไฟล์ตั้งค่าด้วย `Copy-Item .env.example .env`
3. เปิด `notepad .env` และใส่ API key หลัง `OPENAI_API_KEY=` ค่าเริ่มต้นใช้ `gpt-5-mini`
4. รัน `npm.cmd start` แล้วเปิดแอปผ่าน [http://127.0.0.1:8765](http://127.0.0.1:8765) ใน Chrome หรือ Edge
5. นำเข้า PDF RDL และ LRR ตามปกติ ระบบเรียก OpenAI ตรวจทุกห้องอัตโนมัติและแสดง RO / RB / ต้องตรวจ พร้อมหลักฐานรายห้อง

ระบบส่ง Rate Code จากรายงาน คำเกี่ยวกับแพ็กเกจ และลำดับชั่วคราวให้ OpenAI การตรวจแต่ละครั้งมีการใช้ API ตามจำนวนข้อมูล ห้องที่ข้อมูลไม่พอจะแจ้งให้ตรวจ FO หาก API ใช้งานไม่ได้ให้ดูสถานะแล้วกดตรวจอีกครั้ง
