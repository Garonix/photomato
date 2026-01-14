import React, { useState, useEffect, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotos, useUploadPhoto, useDeletePhoto } from '../api/hooks';
import { Lightbox } from './Lightbox';
import { useAlertDialog } from '../components/ui/AlertDialog'; // Import custom alert hook

// Default breakpoints, will be scaled by density factor
const baseBreakpoints = {
    default: 5,
    1920: 5,
    1536: 4,
    1280: 3,
    1024: 3,
    768: 2,
    640: 1
};

export function Gallery({ alias }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = usePhotos(alias);
    const uploadMutation = useUploadPhoto();
    const deleteMutation = useDeletePhoto();
    const { confirm } = useAlertDialog(); // Use custom confirm

    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);

    // Density State (1 = Normal, 0.5 = Sparse, 2 = Dense)
    // Slider range: 0 to 100. Persisted to localStorage.
    const [density, setDensity] = useState(() => {
        const saved = localStorage.getItem('gallery-density');
        return saved !== null ? parseInt(saved) : 50;
    });
    const [activeCols, setActiveCols] = useState(baseBreakpoints);

    // Gap State: Controls spacing between photos (0-32px). Persisted to localStorage.
    const [gap, setGap] = useState(() => {
        const saved = localStorage.getItem('gallery-gap');
        return saved !== null ? parseInt(saved) : 16;
    });

    // Persist density to localStorage
    useEffect(() => {
        localStorage.setItem('gallery-density', density.toString());
    }, [density]);

    // Persist gap to localStorage
    useEffect(() => {
        localStorage.setItem('gallery-gap', gap.toString());
    }, [gap]);

    // Calculate columns based on density
    useEffect(() => {
        // Map 0-100 to a multiplier roughly 0.6x to 2x columns
        const multiplier = 0.6 + (density / 100) * 1.2;

        const newBreakpoints = {};
        for (const [key, val] of Object.entries(baseBreakpoints)) {
            newBreakpoints[key] = Math.max(1, Math.round(val * multiplier));
        }
        setActiveCols(newBreakpoints);
    }, [density]);


    // Context Menu Logic
    const handleContextMenu = (e, photo) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            photo
        });
    };
    const closeContextMenu = () => setContextMenu(null);
    useEffect(() => {
        const handleClick = () => closeContextMenu();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleMenuAction = async (action) => {
        if (!contextMenu) return;
        const { photo } = contextMenu;
        /* ... Action Logic ... */
        switch (action) {
            case 'copy':
                const url = window.location.origin + `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`;
                navigator.clipboard.writeText(url);
                break;
            case 'download':
                const downloadUrl = `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`;
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = photo.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                break;
            case 'delete':
                // Use custom confirm dialog
                const isConfirmed = await confirm({
                    title: "删除确认",
                    description: `确定要删除 "${photo.name}" 吗？此操作不可恢复。`,
                    confirmText: "删除",
                    isDestructive: true
                });

                if (isConfirmed) {
                    try {
                        await deleteMutation.mutateAsync({ alias, path: photo.path });
                    } catch (e) { alert("删除失败"); }
                }
                break;
            case 'move':
                alert("移动功能即将上线");
                break;
        }
        closeContextMenu();
    };

    // D&D Logic
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget)) return; setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = async (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;
        setUploadStatus('uploading');
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('alias', alias);
        try {
            await uploadMutation.mutateAsync({ alias, formData });
            setUploadStatus('success');
            setTimeout(() => setUploadStatus(null), 2000);
        } catch (error) {
            setUploadStatus('error');
            setTimeout(() => setUploadStatus(null), 3000);
        }
    };

    if (status === 'pending') return <div className="flex justify-center h-64 text-neutral-300 animate-pulse mt-12">Loading...</div>;
    if (status === 'error') return <div className="flex justify-center h-64 text-red-500 mt-12">Failed to load.</div>;

    const allPhotos = data?.pages?.flatMap((page) => page.photos ?? []) ?? [];

    const handleClose = () => setSelectedPhotoIndex(null);
    const handleNext = () => setSelectedPhotoIndex((prev) => (prev + 1 < allPhotos.length ? prev + 1 : prev));
    const handlePrev = () => setSelectedPhotoIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));

    return (
        <div
            className="w-full min-h-full relative p-6 pb-24"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white border border-neutral-100 shadow-xl rounded-md py-1 w-48 text-sm text-neutral-700 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => handleMenuAction('copy')} className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        复制链接
                    </button>
                    <button onClick={() => handleMenuAction('download')} className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        下载
                    </button>
                    <button onClick={() => handleMenuAction('move')} className="w-full text-left px-4 py-2 hover:bg-neutral-50 hover:text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"></polyline><path d="M9 12a4 4 0 0 1 4-4h7"></path><path d="M14 8V5L22 12l-8 7v-3"></path></svg>
                        移动...
                    </button>
                    <div className="h-px bg-neutral-100 my-1"></div>
                    <button onClick={() => handleMenuAction('delete')} className="w-full text-left px-4 py-2 hover:bg-brand-50 text-brand-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        删除
                    </button>
                </div>
            )}

            {/* D&D Overlay */}
            {(isDragging || uploadStatus === 'uploading') && (
                <div className="fixed inset-64 right-0 bottom-0 top-0 z-40 bg-white/95 backdrop-blur-md flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
                    <div className="text-center p-12 border-2 border-brand-500 border-dashed rounded-3xl">
                        {uploadStatus === 'uploading' ? (
                            <>
                                <div className="inline-block w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="font-bold text-brand-600 text-xl">上传中...</p>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                </div>
                                <p className="font-bold text-2xl text-neutral-800 tracking-tight">松开上传照片</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Toasts */}
            {uploadStatus === 'success' && (
                <div className="fixed bottom-8 right-8 z-50 bg-white border border-green-200 text-green-700 px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-bounce font-medium">
                    <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">✓</span> 上传成功
                </div>
            )}
            {uploadStatus === 'error' && (
                <div className="fixed bottom-8 right-8 z-50 bg-white border border-red-200 text-red-700 px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 font-medium">
                    <span className="flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">✕</span> 上传失败
                </div>
            )}


            <div className="flex items-center justify-center mb-8">
                {/* Centered Control Group */}
                <div className="flex items-center gap-2 group p-1 rounded-full hover:bg-neutral-50 hover:shadow-sm border border-transparent hover:border-neutral-100 transition-all">
                    {/* Left: Density Slider - Shows on Hover */}
                    <div className="w-0 overflow-hidden group-hover:w-32 transition-all duration-300 ease-out flex items-center opacity-0 group-hover:opacity-100">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={density}
                            onChange={(e) => setDensity(parseInt(e.target.value))}
                            className="w-28 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-brand-500 focus:outline-none ml-2"
                        />
                    </div>

                    {/* Center: Item Count - Trigger */}
                    <div className="text-neutral-400 text-xs font-mono bg-neutral-100 px-2.5 py-1 rounded-full cursor-col-resize group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors whitespace-nowrap select-none">
                        {allPhotos.length}
                    </div>

                    {/* Right: Gap Slider - Shows on Hover */}
                    <div className="w-0 overflow-hidden group-hover:w-32 transition-all duration-300 ease-out flex items-center opacity-0 group-hover:opacity-100">
                        <input
                            type="range"
                            min="0"
                            max="32"
                            value={gap}
                            onChange={(e) => setGap(parseInt(e.target.value))}
                            className="w-28 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-brand-500 focus:outline-none mr-2"
                        />
                    </div>
                </div>
            </div>

            {allPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-300 border-2 border-dashed border-neutral-200 rounded-3xl bg-neutral-50/30">
                    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-neutral-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </div>
                    <p className="mb-2 text-lg font-medium text-neutral-400">暂无照片</p>
                    <p className="text-sm text-neutral-400">拖放图片到此处上传</p>
                </div>
            ) : (
                <Masonry
                    breakpointCols={activeCols}
                    className="flex w-auto"
                    columnClassName="bg-clip-padding"
                    style={{ marginLeft: `-${gap}px` }}
                >
                    {allPhotos.map((photo, index) => (
                        <motion.div
                            layoutId={photo.id}
                            key={photo.id}
                            className="relative group break-inside-avoid"
                            style={{ paddingLeft: `${gap}px`, marginBottom: `${gap}px` }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, type: "spring" }} // Smooth Layout Transition
                        >
                            <div
                                className="rounded-sm overflow-hidden bg-neutral-100 transition-all duration-300 ease-out cursor-pointer hover:shadow-xl hover:shadow-neutral-900/10 hover:-translate-y-1 hover:brightness-[1.02]"
                                onClick={() => setSelectedPhotoIndex(index)}
                                onContextMenu={(e) => handleContextMenu(e, photo)}
                            >
                                <img
                                    src={`/api/v1/thumb?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`}
                                    alt={photo.name}
                                    loading="lazy"
                                    className="w-full h-auto block select-none"
                                />
                            </div>
                        </motion.div>
                    ))}
                </Masonry>
            )}

            {hasNextPage && allPhotos.length > 0 && (
                <div className="mt-16 flex justify-center pb-8">
                    <button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="px-10 py-3 bg-white border border-neutral-200 hover:border-brand-300 text-neutral-600 rounded-full text-sm font-semibold tracking-wide transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {isFetchingNextPage ? '加载中...' : '加载更多'}
                    </button>
                </div>
            )}

            {/* Lightbox with AnimatePresence for exit animation */}
            <AnimatePresence>
                {selectedPhotoIndex !== null && (
                    <Lightbox
                        photo={{ ...allPhotos[selectedPhotoIndex], alias }}
                        onClose={handleClose}
                        onNext={handleNext}
                        onPrev={handlePrev}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
