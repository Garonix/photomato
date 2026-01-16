import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlbumCapsule } from './AlbumCapsule';

export function Header({
    // Album navigation
    aliases = [],
    activeAlias,
    onAliasChange,
    onOpenSettings,
    // Gallery controls (passed from parent, controlled by Gallery via callbacks)
    galleryControls,
    // UI State
    isSettingsOpen = false
}) {
    const {
        // State values
        isSelectMode = false,
        selectedCount = 0,
        viewMode = 'masonry',
        density = 50,
        gap = 16,
        photoCount = 0,
        itemsPerPage = 24,
        uploadRotation = 0,
        // Callbacks
        onToggleSelectMode,
        onBatchMove,
        onBatchDelete,
        onDensityChange,
        onGapChange,
        onViewModeToggle,
        onUploadClick,
    } = galleryControls || {};

    return (
        <header className="h-14 bg-white border-b border-neutral-100 flex items-center px-6 flex-shrink-0 z-40">
            {/* Left: Logo + Album Capsule */}
            <div className="flex items-center gap-3">
                {/* Logo Placeholder - Hidden in Settings */}
                <AnimatePresence>
                    {!isSettingsOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.3 }}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-red-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
                        >
                            P
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Album Capsule - Hidden in Settings */}
                <AnimatePresence>
                    {!isSettingsOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <AlbumCapsule
                                aliases={aliases}
                                activeAlias={activeAlias}
                                onAliasChange={onAliasChange}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Selection info (only in select mode and not in settings) */}
                <AnimatePresence>
                    {isSelectMode && !isSettingsOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-2"
                        >
                            <span className="text-sm text-neutral-500">
                                已选择 <span className="font-semibold text-brand-600">{selectedCount}</span> 张
                            </span>
                            <AnimatePresence>
                                {selectedCount > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center gap-2"
                                    >
                                        <button
                                            onClick={onBatchMove}
                                            className="px-3 py-1.5 text-sm rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                                        >
                                            移动
                                        </button>
                                        <button
                                            onClick={onBatchDelete}
                                            className="px-3 py-1.5 text-sm rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                                        >
                                            删除
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Center: Density/Gap Control Group - Hidden in Settings */}
            {galleryControls && !isSettingsOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 group p-1 rounded-full hover:bg-neutral-50 hover:shadow-sm border border-transparent hover:border-neutral-100 transition-all">
                    {/* Left: Density Slider - Shows on Hover */}
                    <div className="w-0 overflow-hidden group-hover:w-32 transition-all duration-300 ease-out flex items-center opacity-0 group-hover:opacity-100">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={density}
                            onChange={(e) => onDensityChange?.(parseInt(e.target.value))}
                            className="w-28 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-brand-500 focus:outline-none ml-2"
                        />
                    </div>

                    {/* Center: Item Count - Trigger */}
                    <div className="text-neutral-400 text-xs font-mono bg-neutral-100 px-2.5 py-1 rounded-full group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors whitespace-nowrap select-none">
                        {viewMode === 'grid' ? `${itemsPerPage}/页` : photoCount}
                    </div>

                    {/* Right: Gap Slider - Shows on Hover (Masonry mode only) */}
                    {viewMode === 'masonry' && (
                        <div className="w-0 overflow-hidden group-hover:w-32 transition-all duration-300 ease-out flex items-center opacity-0 group-hover:opacity-100">
                            <input
                                type="range"
                                min="0"
                                max="32"
                                value={gap}
                                onChange={(e) => onGapChange?.(parseInt(e.target.value))}
                                className="w-28 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-brand-500 focus:outline-none mr-2"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Right: Controls + Settings */}
            <div className="ml-auto flex items-center gap-1">
                <AnimatePresence>
                    {galleryControls && !isSettingsOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-1"
                        >
                            {/* Select Mode Toggle */}
                            <button
                                onClick={onToggleSelectMode}
                                className={`p-2 rounded-full transition-colors ${isSelectMode ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200' : 'hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600'}`}
                                title={isSelectMode ? "退出多选" : "多选"}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="transition-transform duration-500"
                                    style={{ transform: isSelectMode ? 'rotate(45deg)' : 'rotate(0deg)' }}
                                >
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                </svg>
                            </button>

                            {/* Upload Button */}
                            <button
                                onClick={onUploadClick}
                                className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                                title="上传图片"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="transition-transform duration-500 ease-out"
                                    style={{ transform: `rotate(${uploadRotation}deg)` }}
                                >
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>

                            {/* View Mode Toggle Button */}
                            <button
                                onClick={onViewModeToggle}
                                className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                                title={viewMode === 'masonry' ? '切换到分页视图' : '切换到瀑布流视图'}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="transition-transform duration-500"
                                    style={{ transform: viewMode === 'masonry' ? 'rotate(0deg)' : 'rotate(180deg)' }}
                                >
                                    <path d="M4 6 L12 19 L20 6 H4 z" />
                                </svg>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Settings Button */}
                <motion.button
                    onClick={onOpenSettings}
                    animate={{ rotate: isSettingsOpen ? 90 : 0 }}
                    transition={{ duration: 0.5 }}
                    className={`p-2 rounded-full transition-colors ${isSettingsOpen
                        ? 'bg-brand-600 text-white hover:bg-brand-600'
                        : 'hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600'
                        }`}
                    title={isSettingsOpen ? "返回主页" : "设置"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </motion.button>
            </div>
        </header>
    );
}
