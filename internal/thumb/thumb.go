package thumb

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"
)

const (
	CacheDir = "./cache/thumbnails"
	Size     = 400 
)

func init() {
	os.MkdirAll(CacheDir, 0755)
}

// GenerateFromFile creates a thumbnail from a local file path
func GenerateFromFile(path string) (string, error) {
	// Generate cache key based on file path and modification time (optional)
	// For simplicity, just path for now. reliability can be improved later.
	hash := md5.Sum([]byte(path))
	key := hex.EncodeToString(hash[:])
	cachePath := filepath.Join(CacheDir, key+".jpg")

	// Check if exists
	if _, err := os.Stat(cachePath); err == nil {
		return cachePath, nil
	}

	// Open source file
	src, err := imaging.Open(path, imaging.AutoOrientation(true))
	if err != nil {
		return "", err
	}

	// Resize
	dst := imaging.Resize(src, Size, 0, imaging.Lanczos)

	// Save to cache
	err = imaging.Save(dst, cachePath, imaging.JPEGQuality(80))
	if err != nil {
		return "", err
	}

	return cachePath, nil
}

// GenerateFromBytes creates a thumbnail from image bytes (for S3 provider)
func GenerateFromBytes(data []byte, identifier string) (string, error) {
	// Generate cache key based on identifier
	hash := md5.Sum([]byte(identifier))
	key := hex.EncodeToString(hash[:])
	cachePath := filepath.Join(CacheDir, key+".jpg")

	// Check if exists
	if _, err := os.Stat(cachePath); err == nil {
		return cachePath, nil
	}

	// Decode image from bytes
	src, err := imaging.Decode(bytes.NewReader(data), imaging.AutoOrientation(true))
	if err != nil {
		return "", err
	}

	// Resize
	dst := imaging.Resize(src, Size, 0, imaging.Lanczos)

	// Save to cache
	err = imaging.Save(dst, cachePath, imaging.JPEGQuality(80))
	if err != nil {
		return "", err
	}

	return cachePath, nil
}

// OpenThumbnail returns a reader for the cached thumbnail file
func OpenThumbnail(cachePath string) (io.Reader, error) {
	return os.Open(cachePath)
}

// ClearCache removes all files in the cache directory
func ClearCache() error {
	dir, err := os.ReadDir(CacheDir)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	for _, d := range dir {
		os.RemoveAll(filepath.Join(CacheDir, d.Name()))
	}
	return nil
}

