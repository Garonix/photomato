package provider

import (
	"io"
	"time"
)

type Photo struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Path         string    `json:"path"` // Relative path or Key
	URL          string    `json:"url"`  // Public access URL
	ThumbnailURL string    `json:"thumbnail_url"`
	Size         int64     `json:"size"`
	ModTime      time.Time `json:"mod_time"`
	IsDir        bool      `json:"is_dir"` // Should be unneeded if flat view, but good for future
}

type Provider interface {
	// List returns photos with cursor-based pagination
	List(cursor string, limit int) ([]Photo, string, error)
	
	// GetThumbnail returns a reader for the thumbnail image
	GetThumbnail(path string) (io.Reader, error)
	
	// GetOriginalURL returns a direct URL (presigned for S3) or local file path
	GetOriginalURL(path string) (string, error)
	
	// Delete removes the file
	Delete(path string) error
	
	// Move moves the file to a destination path
	Move(src, dest string) error

	// Upload saves a file to the provider, handling name conflicts
	Upload(filename string, data io.Reader) (string, error)

	// GetFileReader returns a reader for the file content
	GetFileReader(path string) (io.ReadCloser, error)
}
