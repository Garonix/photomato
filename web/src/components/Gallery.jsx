import React, { useState, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhotos, useUploadPhoto, useDeletePhoto, useMovePhotos } from '../api/hooks';
import { Lightbox } from './Lightbox';
import { useAlertDialog } from '../components/ui/AlertDialog';
import { useToast } from './ui/Toast';
import { MoveDialog } from './MoveDialog';
import { PhotoCard } from './PhotoCard';
import { ContextMenu } from './ContextMenu';
import { DragOverlay, UploadToast, EmptyGallery } from './UploadOverlay';
import { usePhotoSelection } from '../hooks/usePhotoSelection';
import { useUpload } from '../hooks/useUpload';

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

export function Gallery({ alias, onControlsReady }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = usePhotos(alias);
    const uploadMutation = useUploadPhoto();
    const deleteMutation = useDeletePhoto();
    const moveMutation = useMovePhotos();
    const { confirm } = useAlertDialog();
    const { addToast } = useToast();

    // Photo selection hook
    const {
        isSelectMode,
        setIsSelectMode,
        selectedPhotos,
        setSelectedPhotos,
        togglePhotoSelection,
        handleSelectionMouseDown,
        handleSelectionMouseEnter,
        exitSelectMode,
    } = usePhotoSelection();

    // Upload hook
    const {
        isDragging,
        uploadStatus,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileInputChange,
    } = useUpload({ alias, uploadMutation });

    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [uploadRotation, setUploadRotation] = useState(0);

    // View mode state
    const [viewMode, setViewMode] = useState(() => {
        const saved = localStorage.getItem('gallery-view-mode');
        return saved || 'masonry';
    });

    // File upload input ref
    const fileInputRef = useRef(null);
    const loadMoreRef = useRef(null);

    // Density & Gap state
    const [density, setDensity] = useState(() => {
        const saved = localStorage.getItem('gallery-density');
        return saved !== null ? parseInt(saved) : 50;
    });
    const [activeCols, setActiveCols] = useState(baseBreakpoints);
    const [gap, setGap] = useState(() => {
        const saved = localStorage.getItem('gallery-gap');
        return saved !== null ? parseInt(saved) : 16;
    });

    // Persist settings
    useEffect(() => { localStorage.setItem('gallery-density', density.toString()); }, [density]);
    useEffect(() => { localStorage.setItem('gallery-gap', gap.toString()); }, [gap]);
    useEffect(() => { localStorage.setItem('gallery-view-mode', viewMode); }, [viewMode]);

    // Infinite scroll
    useEffect(() => {
        if (viewMode !== 'masonry' || !hasNextPage) return;
        const sentinel = loadMoreRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [viewMode, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Photos data
    const allPhotos = data?.pages?.flatMap((page) => page.photos ?? []) ?? [];
    // Get total count and scanning status from the first page (or any page)
    const firstPage = data?.pages?.[0];
    const totalCount = firstPage?.total_count ?? allPhotos.length;
    const isScanning = firstPage?.is_scanning ?? false;

    const itemsPerPage = Math.round(12 + (density / 100) * 48);
    const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage)); // Use totalCount for pagination calculation

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const displayPhotos = viewMode === 'grid'
        ? allPhotos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : allPhotos;

    const SELECTION_INDICATOR_SIZE = 24;
    const effectiveGap = isSelectMode ? Math.max(gap, SELECTION_INDICATOR_SIZE) : gap;

    // Calculate columns based on density
    useEffect(() => {
        const multiplier = 0.6 + (density / 100) * 1.2;
        const newBreakpoints = {};
        for (const [key, val] of Object.entries(baseBreakpoints)) {
            newBreakpoints[key] = Math.max(1, Math.round(val * multiplier));
        }
        setActiveCols(newBreakpoints);
    }, [density]);

    // Register controls with parent
    useEffect(() => {
        if (onControlsReady) {
            onControlsReady({
                isSelectMode,
                selectedCount: selectedPhotos.size,
                viewMode,
                density,
                gap,
                photoCount: totalCount, // Use totalCount from backend
                isScanning,             // Pass scanning status
                itemsPerPage,
                uploadRotation,
                onToggleSelectMode: () => isSelectMode ? exitSelectMode() : setIsSelectMode(true),
                onBatchMove: handleBatchMove,
                onBatchDelete: handleBatchDelete,
                onDensityChange: setDensity,
                onGapChange: setGap,
                onViewModeToggle: () => {
                    setViewMode(prev => prev === 'masonry' ? 'grid' : 'masonry');
                    setCurrentPage(1);
                },
                onUploadClick: () => {
                    setUploadRotation(prev => prev + 90);
                    fileInputRef.current?.click();
                },
            });
        }
    }, [onControlsReady, isSelectMode, selectedPhotos.size, viewMode, density, gap, totalCount, isScanning, itemsPerPage, uploadRotation]);

    // Context Menu
    const handleContextMenu = (e, photo) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, photo });
    };
    const closeContextMenu = () => setContextMenu(null);

    useEffect(() => {
        const handleClick = () => closeContextMenu();
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showMoveDialog) {
                    setShowMoveDialog(false);
                } else if (isSelectMode) {
                    exitSelectMode();
                }
            }
        };
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showMoveDialog, isSelectMode, exitSelectMode]);

    const handleMenuAction = async (action, photo) => {
        switch (action) {
            case 'copy':
                const url = window.location.origin + `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`;
                navigator.clipboard.writeText(url);
                break;
            case 'copyImage':
                try {
                    const imageUrl = `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(photo.path)}`;
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                } catch (e) { alert("复制图片失败"); }
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
                const isConfirmed = await confirm({
                    title: "删除确认",
                    description: `确定要删除 "${photo.name}" 吗？此操作不可恢复。`,
                    confirmText: "删除",
                    isDestructive: true
                });
                if (isConfirmed) {
                    try { await deleteMutation.mutateAsync({ alias, path: photo.path }); }
                    catch (e) { alert("删除失败"); }
                }
                break;
            case 'move':
                setSelectedPhotos(new Set([photo.id]));
                setShowMoveDialog(true);
                break;
        }
    };

    // Batch operations
    const handleBatchDelete = async () => {
        if (selectedPhotos.size === 0) return;
        const isConfirmed = await confirm({
            title: "批量删除确认",
            description: `确定要删除选中的 ${selectedPhotos.size} 张照片吗？此操作不可恢复。`,
            confirmText: "删除",
            isDestructive: true
        });
        if (isConfirmed) {
            try {
                const photosToDelete = allPhotos.filter(p => selectedPhotos.has(p.id));
                for (const photo of photosToDelete) {
                    await deleteMutation.mutateAsync({ alias, path: photo.path });
                }
                exitSelectMode();
            } catch (e) { alert("部分删除失败"); }
        }
    };

    const handleBatchMove = () => {
        if (selectedPhotos.size === 0) return;
        setShowMoveDialog(true);
    };

    const handleConfirmMove = async (destAlias) => {
        const photosToMove = allPhotos.filter(p => selectedPhotos.has(p.id));
        const paths = photosToMove.map(p => p.path);
        try {
            await moveMutation.mutateAsync({ alias, paths, destAlias });
            addToast({ title: "移动成功", type: "success" });
            exitSelectMode();
        } catch (e) {
            addToast({ title: "移动失败", description: "请稍后重试", type: "error" });
        } finally {
            setShowMoveDialog(false);
        }
    };

    // Lightbox handlers
    const handleClose = () => setSelectedPhotoIndex(null);
    const handleNext = () => setSelectedPhotoIndex((prev) => (prev + 1 < allPhotos.length ? prev + 1 : prev));
    const handlePrev = () => setSelectedPhotoIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
    const handleOpenPhoto = (photo) => setSelectedPhotoIndex(allPhotos.findIndex(p => p.id === photo.id));

    if (status === 'pending') return <div className="flex justify-center h-64 text-neutral-300 animate-pulse mt-12">Loading...</div>;
    if (status === 'error') return <div className="flex justify-center h-64 text-red-500 mt-12">Failed to load.</div>;

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
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    photo={contextMenu.photo}
                    onAction={handleMenuAction}
                    onClose={closeContextMenu}
                />
            )}

            {/* Upload Overlays */}
            <DragOverlay isDragging={isDragging} uploadStatus={uploadStatus} />
            <UploadToast status={uploadStatus} />

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/*"
                multiple
                className="hidden"
            />

            {allPhotos.length === 0 ? (
                <EmptyGallery />
            ) : viewMode === 'masonry' ? (
                <Masonry
                    breakpointCols={activeCols}
                    className="flex w-auto"
                    columnClassName="bg-clip-padding"
                    style={{ marginLeft: `-${effectiveGap}px` }}
                >
                    {displayPhotos.map((photo) => (
                        <motion.div
                            layoutId={photo.id}
                            key={photo.id}
                            className="group break-inside-avoid"
                            style={{ paddingLeft: `${effectiveGap}px`, marginBottom: `${effectiveGap}px` }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, type: "spring" }}
                        >
                            <PhotoCard
                                photo={photo}
                                alias={alias}
                                isSelectMode={isSelectMode}
                                isSelected={selectedPhotos.has(photo.id)}
                                variant="masonry"
                                onSelect={togglePhotoSelection}
                                onOpen={handleOpenPhoto}
                                onContextMenu={handleContextMenu}
                                onSelectionMouseDown={handleSelectionMouseDown}
                                onSelectionMouseEnter={handleSelectionMouseEnter}
                                setIsSelectMode={setIsSelectMode}
                            />
                        </motion.div>
                    ))}
                </Masonry>
            ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {displayPhotos.map((photo) => (
                        <motion.div
                            key={photo.id}
                            className="group"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <PhotoCard
                                photo={photo}
                                alias={alias}
                                isSelectMode={isSelectMode}
                                isSelected={selectedPhotos.has(photo.id)}
                                variant="grid"
                                onSelect={togglePhotoSelection}
                                onOpen={handleOpenPhoto}
                                onContextMenu={handleContextMenu}
                                onSelectionMouseDown={handleSelectionMouseDown}
                                onSelectionMouseEnter={handleSelectionMouseEnter}
                                setIsSelectMode={setIsSelectMode}
                            />
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Pagination for Grid View */}
            {viewMode === 'grid' && allPhotos.length > 0 && (
                <div className="mt-12 flex items-center justify-center gap-4 pb-8">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm rounded-full bg-white border border-neutral-200 text-neutral-600 hover:border-brand-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        上一页
                    </button>
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <input
                            type="number"
                            min="1"
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setCurrentPage(Math.min(Math.max(1, val), totalPages));
                            }}
                            className="w-12 px-2 py-1 text-center border border-neutral-200 rounded-lg focus:outline-none focus:border-brand-400"
                        />
                        <span>/</span>
                        <span>{totalPages}</span>
                    </div>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm rounded-full bg-white border border-neutral-200 text-neutral-600 hover:border-brand-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        下一页
                    </button>
                </div>
            )}

            {/* Infinite scroll sentinel */}
            {viewMode === 'masonry' && allPhotos.length > 0 && (
                <div ref={loadMoreRef} className="w-full h-1" />
            )}

            {/* Lightbox */}
            <AnimatePresence>
                {selectedPhotoIndex !== null && (
                    <Lightbox
                        photo={{ ...allPhotos[selectedPhotoIndex], alias }}
                        onClose={handleClose}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        hasNext={selectedPhotoIndex + 1 < allPhotos.length}
                        hasPrev={selectedPhotoIndex > 0}
                        prevPhotoUrl={selectedPhotoIndex > 0
                            ? `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(allPhotos[selectedPhotoIndex - 1].path)}`
                            : null}
                        nextPhotoUrl={selectedPhotoIndex + 1 < allPhotos.length
                            ? `/api/v1/file?alias=${encodeURIComponent(alias)}&path=${encodeURIComponent(allPhotos[selectedPhotoIndex + 1].path)}`
                            : null}
                    />
                )}
            </AnimatePresence>

            <MoveDialog
                open={showMoveDialog}
                onClose={() => setShowMoveDialog(false)}
                onConfirm={handleConfirmMove}
                currentAlias={alias}
                selectedCount={selectedPhotos.size}
            />

            {/* Transfer Indicator */}
            <AnimatePresence>
                {moveMutation.isPending && (
                    <div className="fixed inset-0 z-[100] bg-white/50 cursor-wait">
                        <TransferIndicator />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TransferIndicator() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShow(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-6 right-6 bg-white px-6 py-4 rounded-xl shadow-2xl border-2 border-brand-600 flex items-center gap-4 z-[101]"
        >
            <div className="relative w-5 h-5">
                <div className="absolute inset-0 border-2 border-brand-200 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-brand-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="flex flex-col">
                <span className="font-semibold text-neutral-900">传输中...</span>
                <span className="text-xs text-neutral-500">可能需要一些时间，请耐心等待</span>
            </div>
        </motion.div>
    );
}
