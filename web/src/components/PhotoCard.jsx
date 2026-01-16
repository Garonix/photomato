import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PhotoCard - 单张照片卡片组件
 * 用于 Masonry 和 Grid 视图
 */
export const PhotoCard = React.memo(function PhotoCard({
    photo,
    alias,
    isSelected,
    variant = 'masonry', // 'masonry' | 'grid'
    onSelect,
    onOpen,
    onContextMenu,
    onSelectionMouseDown,
    onSelectionMouseEnter,
    setIsSelectMode,
    interactionRef, // { current: { isSelectMode: boolean } }
}) {
    const longPressTimerRef = useRef(null);

    const clearLongPress = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleClick = (e) => {
        if (interactionRef?.current?.isSelectMode) {
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

        if (interactionRef?.current?.isSelectMode) {
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
        if (!interactionRef?.current?.isSelectMode) {
            longPressTimerRef.current = setTimeout(() => {
                setIsSelectMode?.(true);
                onSelectionMouseDown?.(photo.id, true);
            }, 500);
        }
    };

    // CSS-based styling logic
    // Using 'group' class relative logic or specific passed down state would require props.
    // However, to avoid re-rendering on isSelectMode change, we rely on parent 'group' class or similar.
    // Actually, simple way: The parent (Gallery) puts a class on the container.
    // We can use CSS modules or just global CSS (Tailwind arbitrary variants).
    // Let's assume parent has `.mode-select` class.

    // Grid Variant
    const containerBase = variant === 'grid'
        ? `relative w-full h-[200px] rounded-sm overflow-hidden bg-neutral-100 transition-all duration-300 ease-out cursor-pointer hover:shadow-xl hover:shadow-neutral-900/10 hover:brightness-[1.02]`
        : `relative rounded-sm overflow-hidden bg-neutral-100 transition-all duration-300 ease-out cursor-pointer hover:shadow-xl hover:shadow-neutral-900/10 hover:-translate-y-1 hover:brightness-[1.02]`;

    // Selected state still needs to be passed as prop (isSelected), so re-render on selection change IS required for that specific card.
    // But switching mode (isSelectMode changing from false->true) affects ALL cards.
    // We want to avoid that.

    // We use CSS to show/hide the checkbox based on parent class `.gallery-select-mode`.
    // And to apply the ring.

    // But wait, `isSelected` is still needed.
    // If `isSelected` is true, we want to show ring regardless of mode? No, usually selection only visible in mode.
    // If we clear selection on exit, isSelected becomes false.

    // Dynamic classes based on isSelected:
    const selectedClass = isSelected ? 'ring-4 ring-brand-500 ring-offset-2' : '';
    const opacityClass = isSelected ? 'opacity-80' : '';

    // CSS trick: use group-XXX from parent? 
    // Gallery container will have `.gallery-select-mode`.
    // We can use `.gallery-select-mode &` in pure CSS, but with Tailwind:
    // We need to add `group` to Gallery container? No, that's too far up for arbitrary descendants usually.
    // We will rely on `isSelected` prop mainly for the ring.
    // For visibility of checkbox:
    // It should be visible if `isSelected` OR `.gallery-select-mode` is active.

    // To make this work without re-rendering on mode switch:
    // The Container Class must NOT change based on isSelectMode prop.
    // But we need to show/hide checkbox.
    // We will render checkbox always, but hide it with CSS.
    // Visible if: 1. `isSelected` is true (always show if selected)
    //            2. OR parent has `.gallery-select-mode` class.

    // Since we don't have direct CSS file access easily here without writing one, 
    // we can use a style tag or just rely on the fact that if we can't use parent selector easily in inline tailwind,
    // we might need to modify Global CSS or index.css.
    // Let's assume we can add a style block or use arbitrary variant `[.gallery-select-mode_&]:block`.

    return (
        <div
            data-photo-id={photo.id}
            className={`${containerBase} ${selectedClass} group/card`}
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
                className={`w-full h-auto block select-none transition-opacity ${variant === 'grid' ? 'h-full object-contain' : ''} ${opacityClass}`}
            />

            {/* Checkbox: Always present in DOM, visibility controlled by CSS */}
            {/* Show if isSelected OR if parent has .gallery-select-mode */}
            {/* We effectively replace AnimatePresence with CSS transition */}
            <div
                className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200
                    ${isSelected ? 'bg-brand-500 border-brand-500 scale-100 opacity-100' : 'bg-white border-neutral-300'}
                    ${/* Logic: if not selected, we want it hidden unless in select mode. */ ''}
                    ${/* Tailwind arbitrary selector seeking parent class */ ''}
                    ${!isSelected ? 'opacity-0 scale-50 [.gallery-select-mode_&]:opacity-100 [.gallery-select-mode_&]:scale-100' : ''}
                `}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        </div>
    );
});
