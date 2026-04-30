import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { About } from './About'

function Root() {
  const [page, setPage] = useState(() =>
    window.location.hash === '#about' ? 'about' : 'app'
  )

  useEffect(() => {
    const onHash = () => setPage(window.location.hash === '#about' ? 'about' : 'app')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return page === 'about' ? <About /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
