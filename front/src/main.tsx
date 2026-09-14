import { StrictMode } from 'react'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import './index.css'
import App from './App.tsx'

type ThemeMode = 'light' | 'dark'

const themeStorageKey = 'agDataCollection.themeMode'

function getInitialThemeMode(): ThemeMode {
  return window.localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light'
}

export function Root() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const darkMode = themeMode === 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  const toggleTheme = () => {
    setThemeMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(themeStorageKey, next)
      return next
    })
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: darkMode ? '#8bc9ff' : '#1677ff',
          colorInfo: darkMode ? '#8bc9ff' : '#1677ff',
          colorTextSecondary: darkMode ? '#b9c5d9' : '#475569',
          borderRadius: 16,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <App darkMode={darkMode} onToggleDarkMode={toggleTheme} />
    </ConfigProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
