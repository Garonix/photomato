import React, { useState, useEffect, useRef } from 'react';
import Masonry from 'react-masonry-css';
import { usePhotos, useUploadPhoto, useDeletePhoto } from '../api/hooks';
import { Lightbox } from './Lightbox';

export function Gallery({ alias }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = usePhotos(alias);
    const uploadMutation = useUploadPhoto();
    const deleteMutation = useDeletePhoto();

    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null); // 'uploading', 'success', 'error'

    // Density State (1-100) -> Maps to column counts
    const [density, setDensity] = useState(50); // Default medium

    // Calculate columns based on density
    // High density (Left/0) -> More columns
    // Low density (Right/100) -> Fewer columns
    // Let's invert: Slider Left (0) = More Columns (Dense), Slider Right (100) = Fewer Columns (Sparse)
    // Actually user said "Left slide ... more images (smaller)". So Lower Value = More Columns.
    // 0 = Max Cols (+2), 50 = Default, 100 = Min Cols (-2)
    const getColumns = (base) => {
        const adjustment = Math.round((50 - density) / 25); // roughly -2 to +2
        return Math.max(1, base + adjustment);
    }

    const breakpointColumnsObj = {
        default: getColumns(5),
        1536: getColumns(4),
        1280: getColumns(3),
        1024: getColumns(3),
        768: getColumns(2),
        640: getColumns(1)
    };

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null); // { x, y, photo }

    // Drag and Drop handlers...
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

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
            console.error("Upload failed", error);
            setUploadStatus('error');
            setTimeout(() => setUploadStatus(null), 3000);
        }
    };

    // Context Menu Handlers
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
                if (confirm(`确定要删除 "${photo.name}" 吗?`)) {
                    try {
                        await deleteMutation.mutateAsync({ alias, path: photo.path });
                    } catch (e) {
                        alert("删除失败");
                    }
                }
                break;
            case 'move':
                alert("移动功能即将上线");
                break;
        }
        closeContextMenu();
    };


    if (status === 'pending') {
        return (
            <div className="flex items-center justify-center h-64 text-neutral-400 animate-pulse">
                加载照片中...
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                加载失败，请检查连接。
            </div>
        );
    }

    const allPhotos = data?.pages.flatMap((page) => page.photos) || [];

    const handleClose = () => setSelectedPhotoIndex(null);
    const handleNext = () => setSelectedPhotoIndex((prev) => (prev + 1 < allPhotos.length ? prev + 1 : prev));
    const handlePrev = () => setSelectedPhotoIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));

    return (
        <div
            className="w-full min-h-full relative p-6"
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
                    <button onClick={() => handleMenuAction('delete')} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        删除
                    </button>
                </div>
            )}

            {/* Drag Overlay (Scoped) */}
            {(isDragging || uploadStatus === 'uploading') && (
                <div className="fixed inset-64 right-0 bottom-0 top-0 z-40 bg-white/95 backdrop-blur-md flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
                    {/* Same drag overlay... */}
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
                                <p className="text-neutral-400 mt-2">支持多文件批量上传</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Success/Error Toasts */}
            {uploadStatus === 'success' && (
                <div className="fixed bottom-8 right-8 z-50 bg-white border border-green-200 text-green-700 px-6 py-3 rounded-lg shadow-xl shadow-green-900/5 flex items-center gap-3 animate-bounce font-medium">
                    <span className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">✓</span>
                    上传成功
                </div>
            )}
            {/* ... Error toast ... */}

            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-neutral-900 tracking-tight select-none">{alias}</h2>
                <div className="flex items-center gap-6">
                    {/* Density Slider */}
                    <div className="group flex items-center gap-2 bg-neutral-100 rounded-full px-4 py-1.5 transition-all hover:bg-neutral-100 w-10 hover:w-48 overflow-hidden h-8">
                        {/* Icon always visible */}
                        <div className="flex-shrink-0 text-brand-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </div>
                        {/* Slider only visible on hover */}
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="25"
                            value={density}
                            onChange={(e) => setDensity(Number(e.target.value))}
                            className="w-32 h-1.5 bg-neutral-300 rounded-lg appearance-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity accent-brand-500"
                        />
                    </div>

                    <span className="text-neutral-400 text-xs font-mono bg-neutral-100 px-2.5 py-1 rounded-full">{allPhotos.length} </span>
                </div>
            </div>

            {allPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-300 border-2 border-dashed border-neutral-100 rounded-3xl">
                    {/* Empty state ... */}
                    <div className="w-16 h-16 mb-4 text-neutral-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </div>
                    <p className="mb-2 text-xl font-medium text-neutral-400">暂无照片</p>
                    <p className="text-sm">拖拽图片到这里添加</p>
                </div>
            ) : (
                <Masonry
                    breakpointCols={breakpointColumnsObj}
                    className="flex w-auto -ml-4"
                    columnClassName="pl-4 bg-clip-padding"
                >
                    {allPhotos.map((photo, index) => (
                        <div key={photo.id} className="mb-4 relative group break-inside-avoid">
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
                        </div>
                    ))}
                </Masonry>
            )}

            {/* Load More Button ... */}
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

            {selectedPhotoIndex !== null && (
                <Lightbox
                    photo={{ ...allPhotos[selectedPhotoIndex], alias }}
                    onClose={handleClose}
                    onNext={handleNext}
                    onPrev={handlePrev}
                />
            )}
        </div>
    );
}
