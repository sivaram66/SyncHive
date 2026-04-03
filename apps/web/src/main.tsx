import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Apply saved theme before first paint — prevents flash
const saved = localStorage.getItem('sh_theme')
const parsed = saved ? JSON.parse(saved) : null
const theme = parsed?.state?.theme ?? 'dark'
document.documentElement.setAttribute('data-theme', theme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
