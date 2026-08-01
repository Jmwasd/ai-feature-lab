import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 벤치마크 도구는 개발 빌드에만 실린다.
// 동적 import라 조건이 false로 접히면 seed/bench 모듈째로 번들에서 빠진다
if (import.meta.env.DEV) {
  void import('./dev/register')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
