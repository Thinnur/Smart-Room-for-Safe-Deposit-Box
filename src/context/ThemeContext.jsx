import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Light mode is the default
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ss-theme') || 'light'
  })

  useEffect(() => {
    // Apply data-theme to <html> — CSS vars pick it up automatically
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ss-theme', theme)
  }, [theme])

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
