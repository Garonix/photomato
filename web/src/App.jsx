import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAliases } from './api/hooks'
import { Gallery } from './components/Gallery'
import { Settings } from './components/Settings'
import { ToastProvider } from './components/ui/Toast'

const queryClient = new QueryClient()

function AppContent() {
  const [activeAlias, setActiveAlias] = useState(null)
  const [view, setView] = useState('gallery') // 'gallery' | 'settings'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Fetch aliases
  const { data: aliases, isLoading: aliasesLoading } = useAliases()

  // Auto-select first alias if none selected and aliases loaded
  useEffect(() => {
    if (!activeAlias && aliases?.length > 0) {
      setActiveAlias(aliases[0].name)
    }
  }, [aliases, activeAlias])

  const handleAliasClick = (name) => {
    setActiveAlias(name);
    setView('gallery');
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex overflow-hidden font-sans">

      {/* Sidebar Open Trigger (Left Edge) */}
      {!isSidebarOpen && (
        <div className="absolute top-0 left-0 h-full w-12 z-50 flex items-center justify-start group">
          {/* Invisible hover area */}
          <div className="absolute inset-0 w-16 bg-transparent" />

          {/* Visible Trigger */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="ml-2 w-8 h-16 bg-white/90 backdrop-blur-md border border-neutral-200 rounded-r-lg shadow-lg flex items-center justify-center text-neutral-400 group-hover:text-brand-500 group-hover:pl-1 transition-all -translate-x-full group-hover:translate-x-0 opacity-0 group-hover:opacity-100 duration-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      )}

      {/* Sidebar */}
      <motion.aside
        initial={{ width: 256, opacity: 1 }}
        animate={{ width: isSidebarOpen ? 256 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} // smooth easeOutQuint-ish
        className="bg-neutral-50 border-r border-neutral-100 flex flex-col h-screen z-20 overflow-hidden shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] relative"
      >
        <div className="p-6 flex items-center justify-between min-w-[256px]">
          <h1 className="text-xl font-bold bg-gradient-to-r from-brand-600 to-red-500 bg-clip-text text-transparent tracking-tight">
            Photomato
          </h1>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-neutral-400 hover:text-neutral-600 transition-colors p-1"
            title="收起菜单"
          >
            {/* Hamburger Icon as requested */}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 w-64 custom-scrollbar">
          {/* Settings Link */}
          <button
            onClick={() => setView('settings')}
            className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-all mb-8 flex items-center gap-3 ${view === 'settings'
              ? 'bg-neutral-200 text-neutral-900 font-medium'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            设置
          </button>

          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-xs uppercase text-neutral-400 font-bold tracking-wider">我的相册</h2>
          </div>

          <div className="space-y-1">
            {aliasesLoading && <div className="text-neutral-400 text-sm px-2 animate-pulse">加载中...</div>}

            {aliases?.map(alias => (
              <div key={alias.name} className="relative group">
                <button
                  onClick={() => handleAliasClick(alias.name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${activeAlias === alias.name && view === 'gallery'
                    ? 'bg-white text-brand-600 font-medium shadow-sm border border-neutral-100'
                    : 'text-neutral-500 hover:bg-white hover:text-neutral-800 hover:shadow-sm'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full transition-colors ${activeAlias === alias.name && view === 'gallery' ? 'bg-brand-500' : 'bg-neutral-300'}`}></span>
                  {alias.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-hidden relative bg-white">
        <AnimatePresence mode="wait">
          {view === 'settings' ? (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 w-full h-full overflow-y-auto custom-scrollbar"
            >
              <Settings />
            </motion.div>
          ) : !activeAlias ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-neutral-300 p-8 text-center select-none"
            >
              <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mb-6 text-neutral-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <p className="mb-2 text-xl font-medium text-neutral-400">未选择相册</p>
              <p className="text-sm">请在左侧选择一个相册开始浏览</p>
            </motion.div>
          ) : (
            <motion.div
              key={`gallery-${activeAlias}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 w-full h-full overflow-y-auto custom-scrollbar"
            >
              {/* Gallery handles its own layout and scrolling now to support full-page D&D */}
              <Gallery alias={activeAlias} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
