import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PhotoCard - 单张照片卡片组件
 * 用于 Masonry 和 Grid 视图
 */
export function PhotoCard({
    photo,
    alias,
    isSelectMode,
    isSelected,
    variant = 'masonry', // 'masonry' | 'grid'
    onSelect,
    onOpen,
    onContextMenu,
    onSelectionMouseDown,
    onSelectionMouseEnter,
    setIsSelectMode,
}) {
    const longPressTimerRef = useRef(null);

    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleClick = (e) => {
        if (isSelectMode) {
            const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (isTouch || e.detail === 0) {
                onSelect?.(photo.id);
            }
        } else {
            onOpen?.(photo);
        }
    };

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouch) return;

        if (isSelectMode) {
            e.preventDefault();
            onSelectionMouseDown?.(photo.id);
        } else {
            longPressTimerRef.current = setTimeout(() => {
                setIsSelectMode?.(true);
                onSelectionMouseDown?.(photo.id, true);
            }, 1000);
        }
    };

    const handleTouchStart = () => {
        clearLongPress();
        if (!isSelectMode) {
            longPressTimerRef.current = setTimeout(() => {
                setIsSelectMode?.(true);
                onSelectionMouseDown?.(photo.id, true);
            }, 500);
        }
    };

    const containerClass = variant === 'grid'
        ? `relative w-full h-[200px] rounded-sm overflow-hidden bg-neutral-100 transition-all duration-300 ease-out cursor-pointer hover:shadow-xl hover:shadow-neutral-900/10 hover:brightness-[1.02] ${isSelectMode && isSelected ? 'ring-4 ring-brand-500 ring-offset-2' : ''}`
        : `relative rounded-sm overflow-hidden bg-neutral-100 transition-all duration-300 ease-out cursor-pointer hover:shadow-xl hover:shadow-neutral-900/10 hover:-translate-y-1 hover:brightness-[1.02] ${isSelectMode && isSelected ? 'ring-4 ring-brand-500 ring-offset-2' : ''}`;

    const imgClass = variant === 'grid'
        ? `w-full h-full object-contain select-none transition-opacity ${isSelectMode && isSelected ? 'opacity-80' : ''}`
        : `w-full h-auto block select-none transition-opacity ${isSelectMode && isSelected ? 'opacity-80' : ''}`;

    return (
        <div
            data-photo-id={photo.id}
            className={containerClass}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={clearLongPress}
            onMouseLeave={clearLongPress}
            onMouseEnter={() => onSelectionMouseEnter?.(photo.id)}
            onContextMenu={(e) => onContextMenu?.(e, photo)}
            onTouchStart={handleTouchStart}
            onTouchEnd={clearLongPress}
            onTouchCancel={clearLongPress}
        >
            <img
                src={`/api/v1/thumb?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`}
                alt={photo.name}
                loading="lazy"
                draggable="false"
                className={imgClass}
            />
            <AnimatePresence>
                {isSelectMode && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2 }}
                        className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${isSelected ? 'bg-brand-500 border-brand-500' : 'bg-white border-neutral-300'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
