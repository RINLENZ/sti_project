import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { store } from './store/store.js'
import { ThemeProvider } from './styles/theme.jsx'
import OfflineBanner from './components/OfflineBanner.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <App />
          <Toaster position="top-right" />
          <OfflineBanner />
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
)