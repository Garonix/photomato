package provider

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	
	"photomato/internal/thumb"
)

type LocalProvider struct {
	RootPath string
}

func NewLocalProvider(rootPath string) (*LocalProvider, error) {
	info, err := os.Stat(rootPath)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", rootPath)
	}
	return &LocalProvider{RootPath: rootPath}, nil
}

func (p *LocalProvider) List(cursor string, limit int) ([]Photo, string, error) {
	entries, err := os.ReadDir(p.RootPath)
	if err != nil {
		return nil, "", err
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
		
		info, _ := entry.Info()
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

	// TODO: Implement actual efficient pagination instead of memory slicing
	// For now, simple slicing
	start := 0
	if cursor != "" {
		for i, p := range allPhotos {
			if p.ID == cursor {
				start = i + 1
				break
			}
		}
	}

	end := start + limit
	if end > len(allPhotos) {
		end = len(allPhotos)
	}

	result := allPhotos[start:end]
	nextCursor := ""
	if end < len(allPhotos) {
		nextCursor = result[len(result)-1].ID
	}

	return result, nextCursor, nil
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
	// For local provider, we might just return the path for now, 
	// but in real API this will likely be a specific API endpoint that streams the file
	return filepath.Join(p.RootPath, path), nil 
}

func (p *LocalProvider) Delete(path string) error {
	fullPath := filepath.Join(p.RootPath, path)
	return os.Remove(fullPath)
}

func (p *LocalProvider) Move(src, dest string) error {
    // dest is relative to provider root
    // TODO: Cross-provider move needs higher level logic.
    // Assuming intra-provider move for now if implemented.
    // For now simple rename
    fullSrc := filepath.Join(p.RootPath, src)
    fullDest := filepath.Join(p.RootPath, dest)
    return os.Rename(fullSrc, fullDest)
}

func (p *LocalProvider) Upload(filename string, data io.Reader) (string, error) {
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
