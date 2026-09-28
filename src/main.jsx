import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ConfigError from './components/ConfigError.jsx'
import { missingConfigKeys } from './lib/firebaseConfig.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {missingConfigKeys.length > 0 ? <ConfigError missing={missingConfigKeys} /> : <App />}
  </StrictMode>,
)
