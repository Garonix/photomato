import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Lightbox({ photo, onClose, onNext, onPrev }) {
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev]);

    // Reset scale when photo changes
    useEffect(() => {
        setScale(1);
    }, [photo]);

    const handleZoomIn = (e) => {
        e.stopPropagation();
        setScale(prev => Math.min(prev + 0.5, 3));
    };

    const handleZoomOut = (e) => {
        e.stopPropagation();
        setScale(prev => Math.max(prev - 0.5, 0.5));
    };

    const handleWrapperClick = (e) => {
        // Close only if clicking the background wrapper (backdrop) or if intended
        // We stop propagation on image click, so clicking background will close
        onClose();
    };

    if (!photo) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-white/98 flex items-center justify-center p-0 overflow-hidden cursor-zoom-out"
                onClick={handleWrapperClick}
            >
                <motion.div
                    className="relative w-full h-full flex items-center justify-center p-4"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    <motion.img
                        key={photo.id}
                        src={`/api/v1/file?alias=${encodeURIComponent(photo.alias)}&path=${encodeURIComponent(photo.path)}`}
                        alt={photo.name}
                        style={{ scale }}
                        className="max-h-full max-w-full object-contain shadow-2xl rounded-sm cursor-default transition-transform duration-200"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                    />
                </motion.div>

                {/* Zoom Controls Overlay */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-full border border-neutral-200/20 shadow-xl px-4 py-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={handleZoomOut}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-neutral-600 hover:text-brand-500 hover:scale-110 active:scale-95 transition-all shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <span className="text-neutral-500 font-mono text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button
                        onClick={handleZoomIn}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-neutral-600 hover:text-brand-500 hover:scale-110 active:scale-95 transition-all shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
