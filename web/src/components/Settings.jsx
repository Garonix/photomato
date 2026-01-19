import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAliases, useAddAlias, useDeleteAlias, useUpdateAlias, useClearCache, useTestS3Connection } from '../api/hooks';
import { useToast } from './ui/Toast';
import { useAlertDialog } from './ui/AlertDialog';

export function Settings() {
    const { data: aliases, isLoading } = useAliases();
    const addAliasMutation = useAddAlias();
    const deleteAliasMutation = useDeleteAlias();
    const updateAliasMutation = useUpdateAlias();
    const clearCacheMutation = useClearCache();
    const testS3Mutation = useTestS3Connection();
    const { addToast } = useToast();
    const { confirm } = useAlertDialog();

    // Local Album State
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    // S3 Album State
    const [s3Name, setS3Name] = useState('');
    const [s3Endpoint, setS3Endpoint] = useState('');
    const [s3Bucket, setS3Bucket] = useState('');
    const [s3AccessKey, setS3AccessKey] = useState('');
    const [s3SecretKey, setS3SecretKey] = useState('');
    const [s3Region, setS3Region] = useState('');
    const [s3Prefix, setS3Prefix] = useState('');
    const [isAddingS3, setIsAddingS3] = useState(false);
    const [showS3Form, setShowS3Form] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    // Edit S3 Modal State
    const [editingS3, setEditingS3] = useState(null); // Full alias object
    const [editS3Name, setEditS3Name] = useState('');
    const [editS3Endpoint, setEditS3Endpoint] = useState('');
    const [editS3Bucket, setEditS3Bucket] = useState('');
    const [editS3AccessKey, setEditS3AccessKey] = useState('');
    const [editS3SecretKey, setEditS3SecretKey] = useState('');
    const [editS3Region, setEditS3Region] = useState('');
    const [editS3Prefix, setEditS3Prefix] = useState('');
    const [isSavingS3, setIsSavingS3] = useState(false);
    const [isTestingEdit, setIsTestingEdit] = useState(false);

    const [isClearing, setIsClearing] = useState(false);

    // Rename State (for local aliases inline edit)
    const [editingAlias, setEditingAlias] = useState(null);
    const [editName, setEditName] = useState('');

    const handleAddLocal = async (e) => {
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

    const handleTestS3 = async (config) => {
        setIsTesting(true);
        try {
            const result = await testS3Mutation.mutateAsync(config);
            if (result.success) {
                addToast({ title: "连接成功", type: "success" });
            } else {
                addToast({ title: "连接失败", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "连接失败", description: error.message || "请检查配置", type: "error" });
        } finally {
            setIsTesting(false);
        }
    };

    const handleAddS3 = async (e) => {
        e.preventDefault();
        if (!s3Name || !s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) return;

        setIsAddingS3(true);
        try {
            await addAliasMutation.mutateAsync({
                name: s3Name,
                type: 's3',
                endpoint: s3Endpoint,
                bucket: s3Bucket,
                access_key: s3AccessKey,
                secret_key: s3SecretKey,
                region: s3Region,
                path: s3Prefix
            });
            setS3Name('');
            setS3Endpoint('');
            setS3Bucket('');
            setS3AccessKey('');
            setS3SecretKey('');
            setS3Region('');
            setS3Prefix('');
            setShowS3Form(false);
            addToast({ title: "S3 存储桶已添加", type: "success" });
        } catch (error) {
            addToast({ title: "添加失败", description: error.message || "请检查配置。", type: "error" });
        } finally {
            setIsAddingS3(false);
        }
    };

    // Open edit modal for S3 alias
    const startEditingS3 = (alias) => {
        setEditingS3(alias);
        setEditS3Name(alias.name);
        setEditS3Endpoint(alias.endpoint || '');
        setEditS3Bucket(alias.bucket || '');
        setEditS3AccessKey(alias.access_key || '');
        setEditS3SecretKey(alias.secret_key || '');
        setEditS3Region(alias.region || '');
        setEditS3Prefix(alias.path || '');
    };

    const cancelEditingS3 = () => {
        setEditingS3(null);
        setEditS3Name('');
        setEditS3Endpoint('');
        setEditS3Bucket('');
        setEditS3AccessKey('');
        setEditS3SecretKey('');
        setEditS3Region('');
        setEditS3Prefix('');
    };

    const handleSaveS3Edit = async () => {
        if (!editS3Name || !editS3Endpoint || !editS3Bucket || !editS3AccessKey || !editS3SecretKey) {
            addToast({ title: "请填写必填字段", type: "error" });
            return;
        }
        setIsSavingS3(true);
        try {
            await updateAliasMutation.mutateAsync({
                oldName: editingS3.name,
                newName: editS3Name,
                endpoint: editS3Endpoint,
                bucket: editS3Bucket,
                access_key: editS3AccessKey,
                secret_key: editS3SecretKey,
                region: editS3Region,
                path: editS3Prefix,
            });
            addToast({ title: "保存成功", type: "success" });
            cancelEditingS3();
        } catch (error) {
            addToast({ title: "保存失败", description: error.message, type: "error" });
        } finally {
            setIsSavingS3(false);
        }
    };

    const handleTestS3Edit = async () => {
        setIsTestingEdit(true);
        try {
            const result = await testS3Mutation.mutateAsync({
                endpoint: editS3Endpoint,
                bucket: editS3Bucket,
                access_key: editS3AccessKey,
                secret_key: editS3SecretKey,
                region: editS3Region,
            });
            if (result.success) {
                addToast({ title: "连接成功", type: "success" });
            } else {
                addToast({ title: "连接失败", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "连接失败", description: error.message, type: "error" });
        } finally {
            setIsTestingEdit(false);
        }
    };

    const handleDelete = async (name) => {
        const isConfirmed = await confirm({
            title: "移除相册确认",
            description: `您确定要移除 "${name}" 吗？这不会删除文件。`,
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

    // Inline rename for local aliases
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

    // Filter aliases by type
    const localAliases = aliases?.filter(a => a.type === 'local') || [];
    const s3Aliases = aliases?.filter(a => a.type === 's3') || [];

    // Local Alias Item Render
    const LocalAliasItem = ({ alias, index, total }) => (
        <div
            key={alias.name}
            className={`group flex items-center justify-between py-3 px-4 hover:bg-neutral-100/50 transition-colors relative ${index !== total - 1 ? 'border-b border-neutral-100' : ''}`}
        >
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
    );

    // S3 Alias Item - With Edit Button
    const S3AliasItem = ({ alias, index, total }) => (
        <div
            key={alias.name}
            className={`group flex items-center justify-between py-3 px-4 hover:bg-neutral-100/50 transition-colors relative ${index !== total - 1 ? 'border-b border-neutral-100' : ''}`}
        >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex-1 min-w-0 pl-2">
                <div className="font-medium text-neutral-900 text-sm flex items-center gap-2">
                    {alias.name}
                    <span className="text-[10px] bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-md font-semibold">S3</span>
                </div>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate">
                    {alias.endpoint}/{alias.bucket}{alias.path ? '/' + alias.path : ''}
                </div>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => startEditingS3(alias)}
                    className="text-neutral-400 hover:text-brand-600 p-1.5 rounded transition-colors"
                    title="编辑"
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
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto px-8 py-12">

            {/* S3 Edit Modal */}
            <AnimatePresence>
                {editingS3 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={cancelEditingS3}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-semibold text-neutral-900 mb-4">编辑 S3 存储</h3>
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs text-neutral-500 mb-1">名称</label>
                                        <input type="text" value={editS3Name} onChange={e => setEditS3Name(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-neutral-500 mb-1">Bucket</label>
                                        <input type="text" value={editS3Bucket} onChange={e => setEditS3Bucket(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-neutral-500 mb-1">Endpoint</label>
                                    <input type="text" value={editS3Endpoint} onChange={e => setEditS3Endpoint(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs text-neutral-500 mb-1">Access Key</label>
                                        <input type="text" value={editS3AccessKey} onChange={e => setEditS3AccessKey(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-neutral-500 mb-1">Secret Key</label>
                                        <input type="password" value={editS3SecretKey} onChange={e => setEditS3SecretKey(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs text-neutral-500 mb-1">Region (可选)</label>
                                        <input type="text" value={editS3Region} onChange={e => setEditS3Region(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-neutral-500 mb-1">前缀 (可选)</label>
                                        <input type="text" value={editS3Prefix} onChange={e => setEditS3Prefix(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100">
                                <button
                                    onClick={handleTestS3Edit}
                                    disabled={isTestingEdit || !editS3Endpoint || !editS3Bucket || !editS3AccessKey || !editS3SecretKey}
                                    className="px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isTestingEdit ? (
                                        <><span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></span> 测试中...</>
                                    ) : (
                                        <><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> 测试连接</>
                                    )}
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={cancelEditingS3}
                                        className="px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleSaveS3Edit}
                                        disabled={isSavingS3}
                                        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                                    >
                                        {isSavingS3 ? '保存中...' : '保存'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Local Albums Section */}
            <section className="mb-16">
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

                <div className="bg-neutral-50/50 rounded-xl border border-neutral-100 overflow-hidden">
                    <AnimatePresence>
                        {showAddForm && (
                            <motion.form
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                onSubmit={handleAddLocal}
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

                    <div>
                        {isLoading ? (
                            <div className="text-neutral-300 py-12 text-center text-sm">加载中...</div>
                        ) : localAliases.length === 0 ? (
                            <div className="text-neutral-400 py-12 text-center text-sm">
                                暂无本地相册
                            </div>
                        ) : (
                            localAliases.map((alias, index) => (
                                <LocalAliasItem key={alias.name} alias={alias} index={index} total={localAliases.length} />
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* S3 Cloud Storage Section */}
            <section className="mb-16">
                <SectionHeader
                    action={
                        !showS3Form && (
                            <button
                                onClick={() => setShowS3Form(true)}
                                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        )
                    }
                >
                    云存储
                </SectionHeader>

                <div className="bg-neutral-50/50 rounded-xl border border-neutral-100 overflow-hidden">
                    <AnimatePresence>
                        {showS3Form && (
                            <motion.form
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                onSubmit={handleAddS3}
                                className="overflow-hidden"
                            >
                                <div className="p-4 bg-white border-b border-neutral-100 space-y-3">
                                    <div className="flex gap-3">
                                        <input type="text" value={s3Name} onChange={e => setS3Name(e.target.value)} placeholder="相册名称" autoFocus className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm placeholder-neutral-400 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                        <input type="text" value={s3Bucket} onChange={e => setS3Bucket(e.target.value)} placeholder="Bucket 名称" className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm placeholder-neutral-400 font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                    <input type="text" value={s3Endpoint} onChange={e => setS3Endpoint(e.target.value)} placeholder="Endpoint (例如: https://s3.amazonaws.com)" className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm placeholder-neutral-400 font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    <div className="flex gap-3">
                                        <input type="text" value={s3AccessKey} onChange={e => setS3AccessKey(e.target.value)} placeholder="Access Key" className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm placeholder-neutral-400 font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                        <input type="password" value={s3SecretKey} onChange={e => setS3SecretKey(e.target.value)} placeholder="Secret Key" className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm placeholder-neutral-400 font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                    <div className="flex gap-3">
                                        <input type="text" value={s3Region} onChange={e => setS3Region(e.target.value)} placeholder="Region (可选)" className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm placeholder-neutral-400 focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                        <input type="text" value={s3Prefix} onChange={e => setS3Prefix(e.target.value)} placeholder="前缀/文件夹 (可选)" className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm placeholder-neutral-400 font-mono focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all" />
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            type="button"
                                            onClick={() => handleTestS3({ endpoint: s3Endpoint, bucket: s3Bucket, access_key: s3AccessKey, secret_key: s3SecretKey, region: s3Region })}
                                            disabled={isTesting || !s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey}
                                            className="px-3 py-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isTesting ? (
                                                <><span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></span> 测试中...</>
                                            ) : (
                                                <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> 测试</>
                                            )}
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setShowS3Form(false); setS3Name(''); setS3Endpoint(''); setS3Bucket(''); setS3AccessKey(''); setS3SecretKey(''); setS3Region(''); setS3Prefix(''); }}
                                                className="text-neutral-500 hover:text-neutral-700 px-4 py-2 text-sm font-medium transition-colors"
                                            >
                                                取消
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isAddingS3 || !s3Name || !s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey}
                                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {isAddingS3 ? '连接中...' : '添加'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <div>
                        {isLoading ? (
                            <div className="text-neutral-300 py-12 text-center text-sm">加载中...</div>
                        ) : s3Aliases.length === 0 ? (
                            <div className="text-neutral-400 py-12 text-center text-sm">
                                暂无云存储
                            </div>
                        ) : (
                            s3Aliases.map((alias, index) => (
                                <S3AliasItem key={alias.name} alias={alias} index={index} total={s3Aliases.length} />
                            ))
                        )}
                    </div>
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

            {/* About Section */}
            <section className="mb-12">
                <SectionHeader>关于</SectionHeader>

                <div className="bg-neutral-50/50 rounded-xl border border-neutral-100 overflow-hidden">
                    <div className="flex justify-center py-8 border-b border-neutral-100">
                        <svg className="w-24 h-24 text-brand-600" viewBox="800 350 450 450" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1006.6 357.2c-2.1 6.8-4 13.1-4.2 14-.4 1.2 1.3 2.6 6.3 5.4 3.7 2 8.5 4.7 10.5 6 2.1 1.3 4.2 2.4 4.8 2.4.5 0 3.9-1.8 7.4-4 3.6-2.2 9.2-5.3 12.6-7l6-3v-26h-39.7z" />
                            <path d="M878 358.6c-1.4.2-7.4 1.2-13.5 2.1l-11 1.7 16.3 1.3c39.8 3.1 72.6 14.7 107.9 38 6.2 4.1 11.5 7.8 11.8 8.4.7 1-18.1 1.4-52 1.1l-21-.2-.6-7.8C914.7 388 914.8 388 880 388c-34.7 0-35.1.2-36 14.4l-.5 8.1-8 .8c-41 4.3-71.5 31.7-79 71.1-1.3 6.6-1.5 23.7-1.5 111.7 0 106.5 0 107.2 4 120.6 6.4 21.3 22.8 39.9 44.7 50.7 15.5 7.7-4.4 7 215.8 7.4 144.7.2 199 0 204.5-.8 19.4-3 39.6-15.6 52.6-32.9 7-9.4 11.4-18.8 14.5-31.1 1.9-7.8 1.9-11.2 1.7-117.3l-.3-109.2-3.6-10.2c-5.4-15.3-10.9-24.3-21.4-34.8-10-10-19.5-16-31.7-20.1-15-5.1-20.4-5.4-99.8-5.4h-75.2c-1 0-1.8-.4-1.8-.8 0-1.8 25.9-18.1 39.5-25 24.3-12.2 62.8-21.8 89-22.3 5.7-.1 6.4-.2 4-.9-12.8-3.7-47.3-5.2-65.5-2.9-34.7 4.3-67.1 15.3-93 31.7-6.1 3.9-20.1 14.3-24 17.9-2 1.9-3.6 2.3-8.8 2.3-4.9 0-6.1-.3-5.5-1.3 1-1.6 7.9-7.8 15.5-13.9l5.8-4.6-3.3-2c-20.8-12.6-44.3-21.6-71.7-27.3-14.4-3-17.1-3.2-38-3.5-12.4-.1-23.6-.1-25 .2m344.2 92.5c11.9 4 21.3 11.7 26.8 22 6.9 13 6.4 4.7 6.7 117.4.3 69.7 0 103.5-.7 107.1-3.1 14.7-12.9 27.3-26.7 34.1l-7.7 3.8-194.4.3c-216.5.2-199.3.8-211-6.7-3.2-2.1-7.7-5.8-10-8.1-4.8-5.1-10.6-16.3-12.1-23.8-.8-3.6-1.1-36.6-1.1-104 0-108.3-.1-105.1 6.1-117.7 5.7-11.6 15.7-20.3 28.3-24.7 4.8-1.6 15.9-1.7 197.4-1.8 191.4 0 192.3 0 198.4 2.1" />
                            <path d="M1005.2 479.5c-35 5.5-67.2 28.8-83.1 60.1C912.8 558 909 573.4 909 593c0 45.5 26.5 86.1 68.7 104.8 17.9 8 36.5 11 57.1 9.3 13.6-1.2 22.4-3.5 35.2-9.1 29.7-12.8 53.1-38 63.3-68 11.7-34.6 6-73.7-15.1-103.5-10-14.1-27.2-28.9-43.2-37-19.4-9.8-46.2-13.7-69.8-10m41.8 38.4c30.5 10.9 50.1 35.1 54.2 67 3.8 29.6-12.7 61.4-39.9 76.5-16.1 8.9-36.9 11.8-53.8 7.6-15.5-3.9-25.7-9.4-36.8-19.9-15.7-14.9-24-34-24.1-55.6 0-22.2 8.6-42 25.1-57.6 8.9-8.4 16.9-13.2 29.1-17.5 9.7-3.5 9.8-3.5 24.7-3.1 12.6.2 16 .7 21.5 2.6" />
                        </svg>
                    </div>
                    <div className="p-4 flex items-center justify-between border-b border-neutral-100 last:border-0">
                        <div>
                            <div className="font-medium text-neutral-900 text-sm">项目地址</div>
                            <div className="text-[11px] text-neutral-400 mt-0.5 font-mono">https://github.com/Garonix/photomato</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href="https://github.com/Garonix/photomato"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg text-xs font-medium transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                GitHub
                            </a>
                        </div>
                    </div>
                    <div className="p-4 border-b border-neutral-100 last:border-0">
                        <div className="font-medium text-neutral-900 text-sm">版权许可</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">Copyright © 2026 Photomato. All rights reserved.</div>
                    </div>
                </div>
            </section>
        </div>
    );
}
