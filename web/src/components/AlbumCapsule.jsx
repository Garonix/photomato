import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function AlbumCapsule({ aliases = [], activeAlias, onAliasChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewAlias, setPreviewAlias] = useState(activeAlias);
    const capsuleRef = useRef(null);
    const buttonRef = useRef(null);
    const debounceRef = useRef(null);
    const searchInputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Sync previewAlias with activeAlias when it changes externally
    useEffect(() => {
        setPreviewAlias(activeAlias);
    }, [activeAlias]);

    // Filter aliases based on search
    const filteredAliases = aliases.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get current index in full list
    const getCurrentIndex = useCallback(() => {
        return aliases.findIndex(a => a.name === previewAlias);
    }, [aliases, previewAlias]);

    // Handle wheel scroll on capsule button - use native event for proper preventDefault
    useEffect(() => {
        const button = buttonRef.current;
        if (!button) return;

        const handleWheel = (e) => {
            if (isOpen) return; // Don't scroll-switch when dropdown is open

            e.preventDefault();
            e.stopPropagation();

            const currentIndex = getCurrentIndex();
            if (currentIndex === -1) return;

            let newIndex = currentIndex;
            if (e.deltaY > 0) {
                // Scroll down = next album
                newIndex = Math.min(currentIndex + 1, aliases.length - 1);
            } else if (e.deltaY < 0) {
                // Scroll up = previous album
                newIndex = Math.max(currentIndex - 1, 0);
            }

            if (newIndex !== currentIndex) {
                const newAlias = aliases[newIndex].name;
                setPreviewAlias(newAlias);

                // Debounce the actual data load
                if (debounceRef.current) {
                    clearTimeout(debounceRef.current);
                }
                debounceRef.current = setTimeout(() => {
                    onAliasChange(newAlias);
                }, 500);
            }
        };

        button.addEventListener('wheel', handleWheel, { passive: false });
        return () => button.removeEventListener('wheel', handleWheel);
    }, [isOpen, getCurrentIndex, aliases, onAliasChange]);

    // Prevent scroll propagation from dropdown
    useEffect(() => {
        const dropdown = dropdownRef.current;
        if (!dropdown || !isOpen) return;

        const handleDropdownWheel = (e) => {
            const { scrollTop, scrollHeight, clientHeight } = dropdown;
            const isAtTop = scrollTop === 0;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight;

            // Only prevent if at boundaries and trying to scroll further
            if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                e.preventDefault();
            }
            e.stopPropagation();
        };

        dropdown.addEventListener('wheel', handleDropdownWheel, { passive: false });
        return () => dropdown.removeEventListener('wheel', handleDropdownWheel);
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (capsuleRef.current && !capsuleRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Handle selecting an album from list
    const handleSelect = (name) => {
        setPreviewAlias(name);
        onAliasChange(name);
        setIsOpen(false);
        setSearchQuery('');
    };

    // Text direction for animation
    const getDirection = () => {
        const currentIndex = aliases.findIndex(a => a.name === activeAlias);
        const previewIndex = aliases.findIndex(a => a.name === previewAlias);
        return previewIndex > currentIndex ? 1 : -1;
    };

    return (
        <div ref={capsuleRef} className="relative">
            {/* Capsule Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 transition-colors text-sm font-medium text-neutral-700 w-[160px] group"
            >
                <div className="relative h-5 overflow-hidden flex-1 min-w-0">
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                            key={previewAlias}
                            initial={{ y: getDirection() * 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: getDirection() * -20, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="block truncate"
                        >
                            {previewAlias || '选择相册'}
                        </motion.span>
                    </AnimatePresence>
                </div>
                {/* Chevron */}
                <motion.svg
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-neutral-400 group-hover:text-neutral-600 transition-colors flex-shrink-0"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </motion.svg>
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-neutral-100 overflow-hidden z-50"
                    >
                        {/* Search Input */}
                        <div className="p-2 border-b border-neutral-100">
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="搜索相册..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-neutral-50 rounded-lg border-none outline-none focus:ring-2 focus:ring-brand-500/20 placeholder:text-neutral-400"
                            />
                        </div>

                        {/* Album List */}
                        <div ref={dropdownRef} className="max-h-64 overflow-y-auto custom-scrollbar">
                            {filteredAliases.length === 0 ? (
                                <div className="px-4 py-8 text-center text-neutral-400 text-sm">
                                    无结果
                                </div>
                            ) : (
                                filteredAliases.map((alias) => (
                                    <button
                                        key={alias.name}
                                        onClick={() => handleSelect(alias.name)}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${alias.name === previewAlias
                                            ? 'bg-brand-50 text-brand-600 font-medium'
                                            : 'text-neutral-600 hover:bg-neutral-50'
                                            }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${alias.name === previewAlias ? 'bg-brand-500' : 'bg-neutral-300'
                                            }`}></span>
                                        <span className="truncate">{alias.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
