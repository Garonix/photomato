package provider

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"photomato/internal/thumb"
)

type S3Provider struct {
	Client     *minio.Client
	BucketName string
	Prefix     string // Optional prefix/folder within the bucket

	// Cache
	mu        sync.RWMutex
	cache     []Photo
	cacheTime time.Time
	scanned   bool
	scanning  bool
}

type S3ProviderConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	UseSSL    bool
	Bucket    string
	Prefix    string
	Region    string
}

func NewS3Provider(cfg S3ProviderConfig) (*S3Provider, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create S3 client: %w", err)
	}

	// Verify bucket exists
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exists, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket existence: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("bucket %s does not exist", cfg.Bucket)
	}

	p := &S3Provider{
		Client:     client,
		BucketName: cfg.Bucket,
		Prefix:     cfg.Prefix,
	}
	
	// Start async scan
	go func() {
		p.refreshCache()
	}()

	return p, nil
}

// invalidateCache clears the cache
func (p *S3Provider) invalidateCache() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cache = nil
	p.scanned = false
	p.cacheTime = time.Time{} // zero time
	
	// Re-trigger scan
	go p.refreshCache()
}

// refreshCache handles locking and scanning
func (p *S3Provider) refreshCache() {
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

	start := time.Now()
	photos, err := p.scan()
	if err != nil {
		fmt.Printf("S3 Scan failed: %v\n", err)
		return
	}
	
	p.mu.Lock()
	// No defer here as we unlock explicitly
	p.cache = photos
	p.cacheTime = time.Now()
	p.scanned = true
	p.mu.Unlock()
	
	fmt.Printf("S3 Refreshed %d photos in %v\n", len(photos), time.Since(start))
}

// scan reads the S3 bucket and builds the photo list
// Caller must hold the lock if writing to cache
func (p *S3Provider) scan() ([]Photo, error) {
	ctx := context.Background()

	prefix := p.Prefix
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}

	opts := minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: false, // No subdirectory recursion
	}

	var allPhotos []Photo
	objectCh := p.Client.ListObjects(ctx, p.BucketName, opts)

	for object := range objectCh {
		if object.Err != nil {
			return nil, object.Err
		}

		// Skip "directories" (keys ending with /)
		if strings.HasSuffix(object.Key, "/") {
			continue
		}

		// Skip hidden files
		name := filepath.Base(object.Key)
		if strings.HasPrefix(name, ".") {
			continue
		}

		// Filter by image extensions
		ext := strings.ToLower(filepath.Ext(name))
		switch ext {
		case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp":
			// Allowed
		default:
			continue
		}

		// Store relative path (without prefix)
		relativePath := object.Key
		if p.Prefix != "" && strings.HasPrefix(relativePath, prefix) {
			relativePath = strings.TrimPrefix(relativePath, prefix)
		}

		allPhotos = append(allPhotos, Photo{
			ID:      object.Key,
			Name:    name,
			Path:    relativePath,
			Size:    object.Size,
			ModTime: object.LastModified,
		})
	}

	// Sort by ModTime desc
	sort.Slice(allPhotos, func(i, j int) bool {
		return allPhotos[i].ModTime.After(allPhotos[j].ModTime)
	})

	return allPhotos, nil
}

func (p *S3Provider) List(cursor string, limit int) ([]Photo, string, error) {
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
		return []Photo{}, "", nil
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

	// Important: Copy the slice to avoid race conditions if caller modifies it
	result := make([]Photo, end-start)
	copy(result, allPhotos[start:end])

	nextCursor := ""
	if end < len(allPhotos) && len(result) > 0 {
		nextCursor = result[len(result)-1].ID
	}

	return result, nextCursor, nil
}

func (p *S3Provider) TotalCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if !p.scanned {
		return -1 // Indicates scanning
	}
	return len(p.cache)
}

func (p *S3Provider) GetThumbnail(path string) (io.Reader, error) {
	ctx := context.Background()

	// Build full key
	key := p.buildKey(path)

	// Download the object to a temp file for thumbnail generation
	object, err := p.Client.GetObject(ctx, p.BucketName, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	defer object.Close()

	// Read into memory (for thumbnail generation)
	data, err := io.ReadAll(object)
	if err != nil {
		return nil, err
	}

	// Generate thumbnail from bytes
	thumbPath, err := thumb.GenerateFromBytes(data, path)
	if err != nil {
		return nil, err
	}

	// Return the thumbnail file
	return thumb.OpenThumbnail(thumbPath)
}

func (p *S3Provider) GetFileReader(path string) (io.ReadCloser, error) {
	ctx := context.Background()
	key := p.buildKey(path)
	return p.Client.GetObject(ctx, p.BucketName, key, minio.GetObjectOptions{})
}

func (p *S3Provider) GetOriginalURL(path string) (string, error) {
	ctx := context.Background()
	key := p.buildKey(path)

	// Generate presigned URL (valid for 1 hour)
	presignedURL, err := p.Client.PresignedGetObject(ctx, p.BucketName, key, time.Hour, nil)
	if err != nil {
		return "", err
	}

	return presignedURL.String(), nil
}

func (p *S3Provider) Delete(path string) error {
	defer p.invalidateCache() // Invalidate cache on change

	ctx := context.Background()
	key := p.buildKey(path)

	return p.Client.RemoveObject(ctx, p.BucketName, key, minio.RemoveObjectOptions{})
}

func (p *S3Provider) Move(src, dest string) error {
	defer p.invalidateCache() // Invalidate cache on change

	ctx := context.Background()

	srcKey := p.buildKey(src)
	destKey := p.buildKey(dest)

	// Copy to new location
	_, err := p.Client.CopyObject(ctx, minio.CopyDestOptions{
		Bucket: p.BucketName,
		Object: destKey,
	}, minio.CopySrcOptions{
		Bucket: p.BucketName,
		Object: srcKey,
	})
	if err != nil {
		return err
	}

	// Delete original
	return p.Client.RemoveObject(ctx, p.BucketName, srcKey, minio.RemoveObjectOptions{})
}

func (p *S3Provider) Upload(filename string, data io.Reader) (string, error) {
	defer p.invalidateCache() // Invalidate cache on change

	ctx := context.Background()

	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, ext)

	finalName := filename
	key := p.buildKey(finalName)

	// Conflict resolution (check if key exists)
	for i := 1; ; i++ {
		_, err := p.Client.StatObject(ctx, p.BucketName, key, minio.StatObjectOptions{})
		if err != nil {
			// Object doesn't exist, we're good
			break
		}
		finalName = fmt.Sprintf("%s_%d%s", name, i, ext)
		key = p.buildKey(finalName)
	}

	// Determine content type
	contentType := "application/octet-stream"
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".png":
		contentType = "image/png"
	case ".gif":
		contentType = "image/gif"
	case ".webp":
		contentType = "image/webp"
	case ".svg":
		contentType = "image/svg+xml"
	case ".bmp":
		contentType = "image/bmp"
	}

	// Read all data into memory to know the size
	buf, err := io.ReadAll(data)
	if err != nil {
		return "", err
	}

	_, err = p.Client.PutObject(ctx, p.BucketName, key, bytes.NewReader(buf), int64(len(buf)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", err
	}

	return finalName, nil
}

func (p *S3Provider) buildKey(path string) string {
	if p.Prefix == "" {
		return path
	}
	
	prefix := p.Prefix
	if !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}
	return prefix + path
}
