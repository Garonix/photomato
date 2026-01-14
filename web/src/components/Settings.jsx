import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAliases, useAddAlias, useDeleteAlias, useUpdateAlias, useClearCache } from '../api/hooks';
import { useToast } from './ui/Toast';
import { useAlertDialog } from './ui/AlertDialog';

export function Settings() {
    const { data: aliases, isLoading } = useAliases();
    const addAliasMutation = useAddAlias();
    const deleteAliasMutation = useDeleteAlias();
    const updateAliasMutation = useUpdateAlias();
    const clearCacheMutation = useClearCache();
    const { addToast } = useToast();
    const { confirm } = useAlertDialog();

    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    // Rename State
    const [editingAlias, setEditingAlias] = useState(null);
    const [editName, setEditName] = useState('');

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName || !newPath) return;

        setIsAdding(true);
        try {
            await addAliasMutation.mutateAsync({
                name: newName,
                type: 'local',
                path: newPath
            });
            setNewName('');
            setNewPath('');
            setShowAddForm(false);
            addToast({ title: "相册已添加", type: "success" });
        } catch (error) {
            addToast({ title: "添加失败", description: "请检查路径是否正确。", type: "error" });
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (name) => {
        const isConfirmed = await confirm({
            title: "移除相册确认",
            description: `您确定要移除 "${name}" 吗？这不会删除本地文件。`,
            confirmText: "移除",
            isDestructive: true
        });

        if (!isConfirmed) return;

        try {
            await deleteAliasMutation.mutateAsync(name);
            addToast({ title: "相册已移除", type: "success" });
        } catch (error) {
            addToast({ title: "移除失败", type: "error" });
        }
    };

    const handleClearCache = async () => {
        const isConfirmed = await confirm({
            title: "清空缓存确认",
            description: "确定要清空所有缩略图缓存吗？下次浏览时图片将重新生成，可能会短暂影响加载速度。",
            confirmText: "清空",
            isDestructive: true
        });

        if (!isConfirmed) return;

        setIsClearing(true);
        try {
            await clearCacheMutation.mutateAsync();
            addToast({ title: "缓存已清空", type: "success" });
        } catch (error) {
            addToast({ title: "清空失败", type: "error" });
        } finally {
            setIsClearing(false);
        }
    };

    const startEditing = (alias) => {
        setEditingAlias(alias.name);
        setEditName(alias.name);
    }

    const cancelEditing = () => {
        setEditingAlias(null);
        setEditName('');
    }

    const saveEditing = async (oldName) => {
        if (!editName || editName === oldName) {
            cancelEditing();
            return;
        }

        try {
            await updateAliasMutation.mutateAsync({ oldName, newName: editName });
            addToast({ title: "重命名成功", type: "success" });
            cancelEditing();
        } catch (error) {
            addToast({ title: "重命名失败", description: "可能名称重复。", type: "error" });
        }
    }

    // Section Header Component
    const SectionHeader = ({ children, action }) => (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="w-1 h-4 bg-brand-600 rounded-full" />
                <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">{children}</h2>
            </div>
            {action}
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto px-8 py-12">

            {/* Local Albums Section */}
            <section className="mb-20">
                <SectionHeader
                    action={
                        !showAddForm && (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        )
                    }
                >
                    本地相册
                </SectionHeader>

                {/* Card container for form + list */}
                <div className="bg-neutral-50/50 rounded-xl border border-neutral-100 overflow-hidden">
                    {/* Add Form - Collapsible with Animation */}
                    <AnimatePresence>
                        {showAddForm && (
                            <motion.form
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                onSubmit={handleAdd}
                                className="overflow-hidden"
                            >
                                <div className="p-4 bg-white border-b border-neutral-100">
                                    <div className="flex gap-3 items-center">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            placeholder="相册名称"
                                            autoFocus
                                            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all"
                                        />
                                        <input
                                            type="text"
                                            value={newPath}
                                            onChange={e => setNewPath(e.target.value)}
                                            placeholder="/path/to/photos"
                                            className="flex-[2] bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isAdding || !newName || !newPath}
                                            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            {isAdding ? '...' : '添加'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowAddForm(false); setNewName(''); setNewPath(''); }}
                                            className="text-neutral-400 hover:text-neutral-600 p-2 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    {/* Alias List */}
                    <div>
                        {isLoading ? (
                            <div className="text-neutral-300 py-12 text-center text-sm">加载中...</div>
                        ) : aliases?.length === 0 ? (
                            <div className="text-neutral-400 py-12 text-center text-sm">
                                暂无相册，点击右上角添加
                            </div>
                        ) : (
                            aliases?.map((alias, index) => (
                                <div
                                    key={alias.name}
                                    className={`group flex items-center justify-between py-3 px-4 hover:bg-neutral-100/50 transition-colors relative ${index !== aliases.length - 1 ? 'border-b border-neutral-100' : ''}`}
                                >
                                    {/* Gray accent line on hover */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="flex-1 min-w-0 pl-2">
                                        {editingAlias === alias.name ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="bg-white border border-brand-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-brand-600 min-w-[150px]"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') saveEditing(alias.name);
                                                        if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                />
                                                <button onClick={() => saveEditing(alias.name)} className="text-brand-600 hover:text-brand-700 p-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </button>
                                                <button onClick={cancelEditing} className="text-neutral-400 hover:text-neutral-600 p-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="font-medium text-neutral-900 text-sm">{alias.name}</div>
                                                <div className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">{alias.path}</div>
                                            </div>
                                        )}
                                    </div>

                                    {editingAlias !== alias.name && (
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => startEditing(alias)}
                                                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded transition-colors"
                                                title="重命名"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(alias.name)}
                                                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded transition-colors"
                                                title="移除"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Cloud Storage Section - Coming Soon */}
            <section className="mb-20 opacity-50">
                <SectionHeader>云存储</SectionHeader>
                <div className="py-8 text-center text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
                    S3 / MinIO 支持开发中
                </div>
            </section>

            {/* System Maintenance Section */}
            <section className="mb-12">
                <SectionHeader>系统维护</SectionHeader>

                <div className="flex items-center justify-between py-3 px-4 bg-neutral-50/50 rounded-xl border border-neutral-100">
                    <div>
                        <div className="font-medium text-neutral-900 text-sm">缩略图缓存</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">清空缓存以解决图片显示异常</div>
                    </div>
                    <button
                        onClick={handleClearCache}
                        disabled={isClearing}
                        className="px-3 py-1.5 bg-white border border-neutral-200 text-neutral-600 hover:border-brand-400 hover:text-brand-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                        {isClearing ? '清空中...' : '清空缓存'}
                    </button>
                </div>
            </section>
        </div>
    );
}
