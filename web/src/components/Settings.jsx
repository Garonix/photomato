import React, { useState } from 'react';
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

    // Rename State
    const [editingAlias, setEditingAlias] = useState(null); // name of alias being edited
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

    return (
        <div className="max-w-5xl mx-auto p-12">
            <h1 className="text-3xl font-bold mb-8 text-neutral-900 tracking-tight">配置中心</h1>

            <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-neutral-800">本地相册</h2>
                </div>

                <div className="bg-white rounded-xl p-8 border border-neutral-200 shadow-sm">
                    {/* Add Form */}
                    <form onSubmit={handleAdd} className="flex gap-4 mb-10 items-end p-4 bg-neutral-50 rounded-lg border border-neutral-100/50">
                        <div className="flex-1">
                            <label className="block text-xs uppercase text-neutral-400 font-bold tracking-wider mb-2">相册名称</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="例如: 假期照片"
                                className="w-full bg-white border border-neutral-200 rounded-md px-4 py-2.5 text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex-[2]">
                            <label className="block text-xs uppercase text-neutral-400 font-bold tracking-wider mb-2">绝对路径</label>
                            <input
                                type="text"
                                value={newPath}
                                onChange={e => setNewPath(e.target.value)}
                                placeholder="/path/to/photos"
                                className="w-full bg-white border border-neutral-200 rounded-md px-4 py-2.5 text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all shadow-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAdding || !newName || !newPath}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-md font-medium transition-colors disabled:opacity-50 shadow-md shadow-brand-500/20 active:translate-y-0.5"
                        >
                            {isAdding ? '添加中...' : '添加'}
                        </button>
                    </form>

                    {/* Alias List */}
                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="text-neutral-400 p-4 text-center">加载中...</div>
                        ) : aliases?.length === 0 ? (
                            <div className="text-neutral-400 italic p-8 text-center bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                                暂无配置相册，请上方添加。
                            </div>
                        ) : (
                            aliases?.map(alias => (
                                <div key={alias.name} className="flex items-center justify-between bg-white p-4 rounded-lg border border-neutral-100 hover:border-neutral-300 hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                        </div>

                                        {editingAlias === alias.name ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="bg-neutral-50 border border-brand-300 rounded px-2 py-1 text-sm focus:outline-none min-w-[150px]"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') saveEditing(alias.name);
                                                        if (e.key === 'Escape') cancelEditing();
                                                    }}
                                                />
                                                <button onClick={() => saveEditing(alias.name)} className="text-green-600 hover:bg-green-50 p-1 rounded"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
                                                <button onClick={cancelEditing} className="text-neutral-400 hover:bg-neutral-100 p-1 rounded"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="font-semibold text-neutral-800 flex items-center gap-2">
                                                    {alias.name}
                                                    <button onClick={() => startEditing(alias)} className="text-neutral-300 hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-all" title="重命名">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                    </button>
                                                </div>
                                                <div className="text-xs text-neutral-400 font-mono mt-0.5">{alias.path}</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDelete(alias.name)}
                                            className="text-neutral-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors"
                                            title="移除"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* S3 Placeholder */}
            <div className="opacity-60 grayscale filter mb-12">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-neutral-400">云存储</h2>
                </div>
                <div className="bg-white rounded-xl p-8 border border-neutral-200 border-dashed">
                    <p className="text-neutral-400 text-center">AWS S3 和 MinIO 支持正在开发中。</p>
                </div>
            </div>

            {/* System Actions */}
            <div className="mb-12">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-neutral-800">系统维护</h2>
                </div>

                <div className="bg-white rounded-xl p-8 border border-neutral-200 shadow-sm flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-neutral-900">缩略图缓存</h3>
                        <p className="text-sm text-neutral-500 mt-1">如果图片显示异常或更新不及时，可以尝试清空缓存。</p>
                    </div>
                    <button
                        onClick={handleClearCache}
                        disabled={isClearing}
                        className="px-4 py-2 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-red-600 rounded-md text-sm transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        {isClearing ? '正在清空...' : '清空缓存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
