// C:\AngelBot\serve-dist.cjs
const express = require('express')
const path = require('path')
const compression = require('compression')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const root = path.join(process.cwd(), 'angelbot.ui', 'dist')
const API = 'http://localhost:3001'

app.use(compression())

// proxy ให้เหมือน dev
app.use(['/api', '/connect', '/license', '/status'], createProxyMiddleware({
  target: API,
  changeOrigin: true,
  ws: true,
}))

// เสิร์ฟไฟล์ build แล้ว
app.use(express.static(root))

// SPA fallback → เสิร์ฟ index.html ให้ทุก route
app.get('*', (req, res) => {
  res.sendFile(path.join(root, 'index.html'))
})

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`UI (dist) running at http://localhost:${PORT}`)
  console.log(`Proxy → ${API} for /api, /connect, /license, /status`)
})
