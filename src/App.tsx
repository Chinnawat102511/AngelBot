// เพิ่มบรรทัดนี้ด้านบน
import AdminTab from './admin/AdminTab'
import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from '@pages/index'
import TF1M from '@pages/TF1M'
import TF5M from '@pages/TF5M'

export default function App() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto 1fr', background: '#0b0f14' }}>
      <header style={{ padding: '14px 18px', borderBottom: '1px solid #17202a', display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ fontWeight: 800, letterSpacing: .3, color: '#e8edf2' }}>Angel Forecast</div>
        <nav style={{ display: 'flex', gap: 10 }}>
          <nav style={{ display: 'flex', gap: 10 }}>
  <Link to="/" style={navLink}>หน้าหลัก</Link>
  <Link to="/tf1m" style={navLink}>TF1M</Link>
  <Link to="/tf5m" style={navLink}>TF5M</Link>
  <Link to="/admin" style={navLink}>Admin</Link> {/* <= เพิ่มตรงนี้ */}
</nav>
        </nav>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9db2c7' }}>Angel Mode: <b>Non</b></div>
      </header>
      <main style={{ padding: 18 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tf1m" element={<TF1M />} />
          <Route path="/tf5m" element={<TF5M />} />
          <Route path="/admin" element={<AdminTab />} />
        </Routes>
      </main>
    </div>
  )
}

const navLink: React.CSSProperties = {
  color: '#9bd0ff',
  textDecoration: 'none',
  padding: '6px 10px',
  borderRadius: 10,
  background: 'rgba(155,208,255,.08)',
  border: '1px solid rgba(155,208,255,.15)'
}
