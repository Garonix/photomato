import { useState, useEffect, useCallback } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useAliases } from './api/hooks'
import { apiClient } from './api/client'
import { Header } from './components/Header'
import { Gallery } from './components/Gallery'
import { Settings } from './components/Settings'
import { LoginPage } from './components/LoginPage'
import { ToastProvider } from './components/ui/Toast'
import { AlertDialogProvider } from './components/ui/AlertDialog'

const queryClient = new QueryClient()

function AppContent() {
  const [activeAlias, setActiveAlias] = useState(null)
  const [view, setView] = useState('gallery') // 'gallery' | 'settings'
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null=loading, false=login needed, true=ok

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await apiClient.get('/auth/check');
        if (data.authenticated) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Gallery controls state (lifted here so Header can access)
  const [galleryControls, setGalleryControls] = useState(null)

  // Fetch aliases
  const { data: aliases, isLoading: aliasesLoading } = useAliases()

  // Auto-select first alias if none selected and aliases loaded
  useEffect(() => {
    if (!activeAlias && aliases?.length > 0) {
      setActiveAlias(aliases[0].name)
    }
  }, [aliases, activeAlias])

  const handleAliasChange = (name) => {
    setActiveAlias(name);
    setView('gallery');
  };

  // Callback for Gallery to register its controls
  const handleGalleryControlsReady = useCallback((controls) => {
    setGalleryControls(controls);
  }, []);

  // Clear controls when leaving gallery view
  useEffect(() => {
    if (view !== 'gallery') {
      setGalleryControls(null);
    }
  }, [view]);

  // Global ESC handler for Settings
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && view === 'settings') {
        setView('gallery');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [view]);

  if (isAuthenticated === null) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#f5f5f7]"></div>;
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="h-screen bg-white text-neutral-900 flex flex-col overflow-hidden font-sans">
      {/* Global Header - Always visible, never scrolls */}
      <Header
        aliases={aliases || []}
        activeAlias={activeAlias}
        onAliasChange={handleAliasChange}
        onOpenSettings={() => setView(v => v === 'settings' ? 'gallery' : 'settings')}
        isSettingsOpen={view === 'settings'}
        galleryControls={galleryControls}
      />

      {/* Main Content - Scrollable area below header */}
      <main
        className="flex-1 overflow-hidden relative bg-white"
        onMouseMove={(e) => {
          const container = e.currentTarget.querySelector('.custom-scrollbar');
          if (!container) return;

          container.dataset.targetOpacity = '0.5';

          if (!container.dataset.animating) {
            container.dataset.animating = 'true';
            const animate = () => {
              const current = parseFloat(container.style.getPropertyValue('--scrollbar-opacity') || '0');
              const target = parseFloat(container.dataset.targetOpacity || '0');
              const diff = target - current;

              if (Math.abs(diff) < 0.01) {
                container.style.setProperty('--scrollbar-opacity', target.toString());
                container.dataset.animating = '';
                return;
              }

              const next = current + diff * 0.15;
              container.style.setProperty('--scrollbar-opacity', next.toString());
              requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }

          if (container.dataset.timeoutId) {
            clearTimeout(parseInt(container.dataset.timeoutId));
          }

          const timeoutId = setTimeout(() => {
            container.dataset.targetOpacity = '0';
            if (!container.dataset.animating) {
              container.dataset.animating = 'true';
              const animateOut = () => {
                const current = parseFloat(container.style.getPropertyValue('--scrollbar-opacity') || '0.5');
                const target = parseFloat(container.dataset.targetOpacity || '0');
                const diff = target - current;

                if (Math.abs(diff) < 0.01) {
                  container.style.setProperty('--scrollbar-opacity', target.toString());
                  container.dataset.animating = '';
                  return;
                }

                const next = current + diff * 0.08;
                container.style.setProperty('--scrollbar-opacity', next.toString());
                requestAnimationFrame(animateOut);
              };
              requestAnimationFrame(animateOut);
            }
          }, 1000);

          container.dataset.timeoutId = timeoutId.toString();
        }}
      >
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
              <p className="text-sm">加载中...</p>
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
              <Gallery
                alias={activeAlias}
                onControlsReady={handleGalleryControlsReady}
              />
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
        <AlertDialogProvider>
          <AppContent />
        </AlertDialogProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
