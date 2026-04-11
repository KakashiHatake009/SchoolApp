import { createContext, useContext, useState, useEffect } from 'react'

const PageTitleContext = createContext<{
  title: string
  setTitle: (t: string) => void
}>({ title: '', setTitle: () => {} })

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState('')
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  )
}

export function usePageTitle() {
  return useContext(PageTitleContext).title
}

/** Call this in a page component to set the navbar title */
export function useSetPageTitle(title: string) {
  const { setTitle } = useContext(PageTitleContext)
  useEffect(() => {
    setTitle(title)
  }, [title, setTitle])
}
