import React from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PlanCard />
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <Card title="TF1M — Reversal Forecast" desc="ตัวคูณ 3, เงื่อนไขเวลาขั้นต่ำ 6 นาที, เตือนล่วงหน้า + Result สีแรง (แดง/เหลือง/ขาว)">
          <Link to="/tf1m" style={btn}>เปิด TF1M</Link>
        </Card>
        <Card title="TF5M — Reversal Forecast" desc="ตัวคูณ 1, ปัดลง 5 นาที (floor), เตือนล่วงหน้า + Result สีแรง">
          <Link to="/tf5m" style={btn}>เปิด TF5M</Link>
        </Card>
      </div>
      <Card title="Server Utility" desc="ทดสอบ API Ping / สร้างไลเซนส์ฝั่ง Server">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a style={btn} href="http://localhost:8787/api/ping" target="_blank">GET /api/ping</a>
        </div>
      </Card>
    </div>
  )
}

function PlanCard() {
  return (
    <div style={{ padding: 16, border: '1px solid #17202a', borderRadius: 14, background: '#0f151d' }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#e8edf2' }}>✅ แผนเข้าไม้ถัดไป</div>
      <div style={{ color: '#b9c7d6' }}>
        ทิศทาง <b>PUT / SELL</b> เมื่อชนแนวต้าน + เบรกแท่งเดียวแล้วกลับตัว (รูปแบบหลักของทีม) — ใช้เวลาไม้ 1–2 นาที — ยืนยันด้วย %R, Stochastic, CCI, DiNapoli พร้อมกัน
      </div>
    </div>
  )
}

function Card(props: React.PropsWithChildren<{title: string, desc: string}>) {
  return (
    <div style={{ padding: 16, border: '1px solid #17202a', borderRadius: 14, background: '#0f151d' }}>
      <div style={{ fontWeight: 700, color: '#e8edf2', marginBottom: 6 }}>{props.title}</div>
      <div style={{ color: '#b9c7d6', marginBottom: 10 }}>{props.desc}</div>
      {props.children}
    </div>
  )
}

const btn: React.CSSProperties = {
  display: 'inline-block',
  color: '#0b0f14',
  background: '#9bd0ff',
  border: '1px solid #9bd0ff',
  borderRadius: 12,
  padding: '8px 12px',
  textDecoration: 'none',
  fontWeight: 700
}
