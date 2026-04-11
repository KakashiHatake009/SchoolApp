import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation()
  const [lang, setLang] = useState(i18n.language?.startsWith('de') ? 'de' : 'en')

  const toggle = () => {
    const next = lang === 'de' ? 'en' : 'de'
    i18n.changeLanguage(next)
    localStorage.setItem('language', next)
    setLang(next)
  }

  return (
    <button
      onClick={toggle}
      className={`text-xs font-medium text-gray-500 hover:text-gray-800 cursor-pointer border border-gray-300 rounded px-2 py-1 transition-colors ${className}`}
      title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
    >
      {lang === 'de' ? 'EN' : 'DE'}
    </button>
  )
}
