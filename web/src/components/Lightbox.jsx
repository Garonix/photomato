import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Lightbox({ photo, onClose, onNext, onPrev }) {
    const [scale, setScale] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);

    // Reset scale when photo changes
    useEffect(() => {
        setScale(1);
    }, [photo]);

    // Handle Mouse Move for auto-hiding
    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 1500); // Hide after 1.5s idle
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        // Init timeout
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [onClose, onNext, onPrev]);


    if (!photo) return null;

    const handleZoomIn = (e) => {
        if (e) e.stopPropagation();
        setScale(p => Math.min(p + 0.5, 4));
    }

    const handleZoomOut = (e) => {
        if (e) e.stopPropagation();
        setScale(p => Math.max(p - 0.5, 0.5));
    }

    const handleWheel = (e) => {
        // e.deltaY < 0 is scrolling up (zoom in)
        if (e.deltaY < 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                className="fixed inset-0 z-50 bg-white/80 flex flex-col items-center justify-center p-4 cursor-default"
                onClick={onClose}
                onWheel={handleWheel}
            >
                {/* Zoom Controls (Auto-Hide) */}
                <AnimatePresence>
                    {showControls && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute bottom-8 flex gap-3 bg-white/90 backdrop-blur-md border border-neutral-200 rounded-full px-5 py-2 shadow-lg z-50 pointer-events-auto cursor-default"
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={handleZoomOut} className="text-neutral-400 hover:text-neutral-900 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            </button>
                            <span className="text-xs font-mono text-neutral-400 flex items-center w-10 justify-center select-none">{Math.round(scale * 100)}%</span>
                            <button onClick={handleZoomIn} className="text-neutral-400 hover:text-neutral-900 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.img
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: scale }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    src={`/api/v1/file?alias=${encodeURIComponent(photo.alias)}&path=${encodeURIComponent(photo.path)}`}
                    alt={photo.name}
                    style={{ maxHeight: 'calc(100vh - 80px)', maxWidth: 'calc(100vw - 40px)' }}
                    className="object-contain shadow-2xl rounded-sm"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                    draggable="false"
                />
            </motion.div>
        </AnimatePresence>
    );
}
