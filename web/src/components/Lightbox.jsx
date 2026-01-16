import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';

export function Lightbox({ photo, onClose, onNext, onPrev, hasNext, hasPrev }) {
    const [scale, setScale] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);
    const imgControls = useAnimation();
    const swipeControls = useAnimation();
    const backdropInteractionRef = useRef(false);

    // Reset scale when photo changes
    useEffect(() => {
        setScale(1);
        // Reset both controls
        imgControls.set({ opacity: 0, scale: 0.95 });
        swipeControls.set({ x: 0 });

        imgControls.start({ opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } });
    }, [photo.id, imgControls, swipeControls]);

    // Handle Mouse Move for auto-hiding
    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 2000);
    };

    // Unified zoom handler
    const updateScale = (delta) => {
        setScale(prev => {
            const newScale = delta > 0
                ? Math.min(prev + delta, 4)
                : Math.max(prev + delta, 0.5);

            // Zooming logic on the IMAGE
            const anim = { scale: newScale, transition: { type: "spring", stiffness: 300, damping: 30 } };
            // If zooming OUT (delta < 0) or resetting, force reset position (visual center)
            if (delta < 0 || newScale <= 1) {
                anim.x = 0;
                anim.y = 0;
            }
            imgControls.start(anim);

            // If returning to 1 or less, ensure swipe wrapper is centered too
            if (newScale <= 1) {
                swipeControls.start({ x: 0 });
            }

            return newScale;
        });
    };

    const handleSwipeDragEnd = (event, info) => {
        if (scale > 1) return; // Should not happen due to drag disable, but safety check

        const { offset, velocity } = info;
        const SWIPE_THRESHOLD = 50;
        // Logic: High velocity OR significant distance
        if (offset.x > 100 || (offset.x > SWIPE_THRESHOLD && velocity.x > 500)) {
            if (hasPrev) onPrev();
            else swipeControls.start({ x: 0, transition: { type: "spring" } });
        } else if (offset.x < -100 || (offset.x < -SWIPE_THRESHOLD && velocity.x < -500)) {
            if (hasNext) onNext();
            else swipeControls.start({ x: 0, transition: { type: "spring" } });
        } else {
            swipeControls.start({ x: 0, transition: { type: "spring" } });
        }
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
            // Zoom shortcut
            if (e.key === '+' || e.key === '=') updateScale(0.25);
            if (e.key === '-') updateScale(-0.25);
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('keydown', handleKeyDown);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [onClose, onNext, onPrev, imgControls, swipeControls]);

    if (!photo) return null;

    const handleZoomIn = (e) => { e?.stopPropagation(); updateScale(0.25); };
    const handleZoomOut = (e) => { e?.stopPropagation(); updateScale(-0.25); };

    // Robust Close Logic: 
    // Only close if interaction STARTED and ENDED on the backdrop
    const handleBackdropPointerDown = (e) => {
        // e.target check ensures we aren't clicking the image or controls
        if (e.target === e.currentTarget) {
            backdropInteractionRef.current = true;
        } else {
            backdropInteractionRef.current = false;
        }
    };

    const handleBackdropPointerUp = (e) => {
        if (e.target === e.currentTarget && backdropInteractionRef.current) {
            onClose();
        }
        backdropInteractionRef.current = false; // Reset
    };

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); }
        if (e.deltaY < 0) handleZoomIn();
        else handleZoomOut();
    };

    const downloadUrl = `/api/v1/file?alias=${encodeURIComponent(photo.alias)}&path=${encodeURIComponent(photo.path)}`;
    const formattedDate = new Date(photo.mod_time).toLocaleString();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/70 backdrop-blur-md flex flex-col items-center justify-center overflow-hidden"
            onPointerDown={handleBackdropPointerDown}
            onPointerUp={handleBackdropPointerUp}
            onWheel={handleWheel}
        >
            {/* Top Bar (Info Only) */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        className="absolute top-0 left-0 right-0 p-6 flex justify-start items-start z-50 pointer-events-none"
                    >
                        <div className="flex flex-col text-neutral-900 pointer-events-auto bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-sm">
                            <p className="text-xs text-neutral-600 font-medium font-mono tracking-tight">{formattedDate} • {(photo.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navigation Arrows */}
            <AnimatePresence>
                {showControls && (
                    <>
                        <motion.button
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            onClick={(e) => { e.stopPropagation(); onPrev(); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-4 text-neutral-500/50 hover:text-neutral-500 z-50 transition-colors pointer-events-auto active:scale-90"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </motion.button>
                        <motion.button
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 20, opacity: 0 }}
                            onClick={(e) => { e.stopPropagation(); onNext(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-4 text-neutral-500/50 hover:text-neutral-500 z-50 transition-colors pointer-events-auto active:scale-90"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </motion.button>
                    </>
                )}
            </AnimatePresence>

            {/* Swipe Container (Handles Scale=1 Gestures) */}
            <motion.div
                className="w-full h-full flex items-center justify-center touch-none"
                animate={swipeControls}
                drag={scale <= 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }} // Elastic snap back
                dragElastic={0.2}
                onDragEnd={handleSwipeDragEnd}
            >
                {/* Main Image (Handles Scale>1 Gestures) */}
                <motion.img
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={imgControls}
                    src={downloadUrl}
                    alt={photo.name}
                    className="max-w-[85vw] max-h-[85vh] object-contain shadow-2xl select-none"
                    onClick={e => e.stopPropagation()}

                    // Pan Logic (Only when zoomed)
                    drag={scale > 1}
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={{
                        left: -100 * scale,
                        right: 100 * scale,
                        top: -100 * scale,
                        bottom: 100 * scale
                    }}
                    draggable="false"
                />
            </motion.div>

            {/* Bottom Zoom Controls */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="absolute bottom-8 flex gap-4 bg-white/80 backdrop-blur-xl border border-neutral-200/50 rounded-full px-6 py-2 shadow-lg shadow-neutral-200/50 z-50 pointer-events-auto items-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <button onClick={handleZoomOut} className="text-neutral-500 hover:text-neutral-900 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                        </button>
                        <span className="text-sm font-mono text-neutral-600 w-12 text-center select-none">{Math.round(scale * 100)}%</span>
                        <button onClick={handleZoomIn} className="text-neutral-500 hover:text-neutral-900 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
