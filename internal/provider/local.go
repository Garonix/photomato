package provider

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"photomato/internal/thumb"
)

type LocalProvider struct {
	RootPath string
	
	// Cache
	mu        sync.RWMutex
	cache     []Photo
	cacheTime time.Time
	scanned   bool
	scanning  bool
}

func NewLocalProvider(rootPath string) (*LocalProvider, error) {
	info, err := os.Stat(rootPath)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", rootPath)
	}
	p := &LocalProvider{RootPath: rootPath}
	
	// Start async scan
	go func() {
		p.refreshCache()
	}()
	
	return p, nil
}

// invalidateCache clears the cache
func (p *LocalProvider) invalidateCache() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cache = nil
	p.scanned = false
	p.cacheTime = time.Time{} // zero time
	
	// Re-trigger scan
	go p.refreshCache()
}

// refreshCache handles locking and scanning
func (p *LocalProvider) refreshCache() {
	p.mu.Lock()
	if p.scanning {
		p.mu.Unlock()
		return
	}
	p.scanning = true
	p.mu.Unlock()

	defer func() {
		p.mu.Lock()
		p.scanning = false
		p.mu.Unlock()
	}()

	photos, err := p.scan()
	if err != nil {
		fmt.Printf("Scan failed: %v\n", err)
		return
	}
	
	p.mu.Lock()
	// No defer here as we unlock explicitly or just fall through (but defer is safer if panic, 
	// actually we hold lock for assignment only)
	p.cache = photos
	p.cacheTime = time.Now()
	p.scanned = true
	p.mu.Unlock()
	
	// fmt.Printf("Refreshed cache with %d photos\n", len(photos))
}

// scan reads the directory and builds the photo list
// No locking inside scan itself
func (p *LocalProvider) scan() ([]Photo, error) {
	entries, err := os.ReadDir(p.RootPath)
	if err != nil {
		return nil, err
	}

	var allPhotos []Photo
	for _, entry := range entries {
		if entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		// Filter extensions
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		switch ext {
		case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp":
			// Allowed
		default:
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}
		allPhotos = append(allPhotos, Photo{
			ID:      entry.Name(),
			Name:    entry.Name(),
			Path:    entry.Name(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
	}

	// Sort by ModTime desc
	sort.Slice(allPhotos, func(i, j int) bool {
		return allPhotos[i].ModTime.After(allPhotos[j].ModTime)
	})

	return allPhotos, nil
}

func (p *LocalProvider) List(cursor string, limit int) ([]Photo, string, error) {
	p.mu.RLock()
	// SWR: If scanned and cache exists, check if we should refresh (older than 20s)
	// If not scanned, we definitely wait or trigger (New starts it).
	elapsed := time.Since(p.cacheTime)
	shouldRefresh := elapsed > 20*time.Second
	isScanning := p.scanning
	p.mu.RUnlock()

	if shouldRefresh && !isScanning {
		go p.refreshCache()
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	
	// If not scanned yet, return empty list instantly
	if !p.scanned && p.cache == nil {
		return []Photo{}, "", nil // Client will see empty list -> 0 count
	}

	allPhotos := p.cache

	// Efficient pagination on the cached slice
	start := 0
	if cursor != "" {
		for i, photo := range allPhotos {
			if photo.ID == cursor {
				start = i + 1
				break
			}
		}
	}

	end := start + limit
	if end > len(allPhotos) {
		end = len(allPhotos)
	}

	// Important: Copy the slice to avoid race conditions if caller modifies it (though Photo is value type)
	// But slicing is safe as long as underlying array isn't modified.
	// Since we replace p.cache entirely on update, the old array is safe to read.
	result := make([]Photo, end-start)
	copy(result, allPhotos[start:end])

	nextCursor := ""
	if end < len(allPhotos) && len(result) > 0 {
		nextCursor = result[len(result)-1].ID
	}

	return result, nextCursor, nil
}

func (p *LocalProvider) TotalCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if !p.scanned {
		return -1 // Indicates scanning
	}
	return len(p.cache)
}

// GetThumbnail generates or retrieves a thumbnail
func (p *LocalProvider) GetThumbnail(path string) (io.Reader, error) {
	fullPath := filepath.Join(p.RootPath, path)
	thumbPath, err := thumb.GenerateFromFile(fullPath)
	if err != nil {
		return nil, err
	}
	return os.Open(thumbPath)
}

func (p *LocalProvider) GetFileReader(path string) (io.ReadCloser, error) {
	fullPath := filepath.Join(p.RootPath, path)
	return os.Open(fullPath)
}

func (p *LocalProvider) GetOriginalURL(path string) (string, error) {
	return filepath.Join(p.RootPath, path), nil
}

func (p *LocalProvider) Delete(path string) error {
	defer p.invalidateCache() // Invalidate cache on change

	fullPath := filepath.Join(p.RootPath, path)
	return os.Remove(fullPath)
}

func (p *LocalProvider) Move(src, dest string) error {
	defer p.invalidateCache() // Invalidate cache on change

	fullSrc := filepath.Join(p.RootPath, src)
	fullDest := filepath.Join(p.RootPath, dest)
	return os.Rename(fullSrc, fullDest)
}

func (p *LocalProvider) Upload(filename string, data io.Reader) (string, error) {
	defer p.invalidateCache() // Invalidate cache on change

	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, ext)

	finalName := filename
	fullPath := filepath.Join(p.RootPath, finalName)

	// Conflict resolution
	for i := 1; ; i++ {
		_, err := os.Stat(fullPath)
		if os.IsNotExist(err) {
			break
		}
		finalName = fmt.Sprintf("%s_%d%s", name, i, ext)
		fullPath = filepath.Join(p.RootPath, finalName)
	}

	out, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	_, err = io.Copy(out, data)
	if err != nil {
		return "", err
	}

	return finalName, nil
}
