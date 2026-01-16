import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAliases } from '../api/hooks';

export function MoveDialog({ open, onClose, onConfirm, currentAlias, selectedCount }) {
    const { data: aliases } = useAliases();
    const [selectedDest, setSelectedDest] = useState(null);

    if (!open) return null;

    // Filter out current alias from destination list
    const availableAliases = aliases?.filter(a => a.name !== currentAlias) || [];

    const handleConfirm = () => {
        if (selectedDest) {
            onConfirm(selectedDest);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-6 border-b border-neutral-100">
                            <h3 className="text-lg font-semibold text-neutral-900">
                                移动 {selectedCount} 张照片
                            </h3>
                            <p className="text-sm text-neutral-500 mt-1">
                                请选择目标相册
                            </p>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto p-2">
                            {availableAliases.length === 0 ? (
                                <div className="p-8 text-center text-neutral-400 text-sm">
                                    暂无其他可用相册
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {availableAliases.map(alias => (
                                        <button
                                            key={alias.name}
                                            onClick={() => setSelectedDest(alias.name)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${selectedDest === alias.name
                                                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                                                    : 'hover:bg-neutral-50 text-neutral-700'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedDest === alias.name ? 'bg-brand-100 text-brand-600' : 'bg-neutral-100 text-neutral-500'
                                                }`}>
                                                {alias.type === 's3' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"></path><path d="M12 11h.01"></path></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{alias.name}</div>
                                                <div className="text-xs text-neutral-400 truncate font-mono opacity-80">
                                                    {alias.type === 's3' ? alias.bucket : alias.path}
                                                </div>
                                            </div>
                                            {selectedDest === alias.name && (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-neutral-50 flex justify-end gap-3 border-t border-neutral-100">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!selectedDest}
                                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                确认移动
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
