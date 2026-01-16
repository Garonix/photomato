package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"photomato/internal/config"
	"photomato/internal/provider"
	"photomato/internal/thumb"
)

type ProviderMap map[string]provider.Provider

type Handler struct {
	Config    *config.Config
	Providers ProviderMap
}

func NewHandler(cfg *config.Config, providers ProviderMap) *Handler {
	return &Handler{
		Config:    cfg,
		Providers: providers,
	}
}

// RegisterRoutes registers all API routes to the given mux
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// Public Auth Routes
	mux.HandleFunc("POST /api/v1/auth/login", h.handleLogin)
	mux.HandleFunc("GET /api/v1/auth/check", h.handleAuthCheck)

	// Protected Routes
	// We wrap these with AuthMiddleware
	protect := h.AuthMiddleware

	mux.Handle("GET /api/v1/aliases", protect(http.HandlerFunc(h.handleGetAliases)))
	mux.Handle("GET /api/v1/photos", protect(http.HandlerFunc(h.handleGetPhotos)))
	mux.Handle("GET /api/v1/file", protect(http.HandlerFunc(h.handleServeFile)))
	mux.Handle("GET /api/v1/thumb", protect(http.HandlerFunc(h.handleGetThumbnail)))
	mux.Handle("DELETE /api/v1/photo", protect(http.HandlerFunc(h.handleDeletePhoto)))
	mux.Handle("POST /api/v1/upload", protect(http.HandlerFunc(h.handleUpload)))
	mux.Handle("POST /api/v1/alias", protect(http.HandlerFunc(h.handleAddAlias)))
	mux.Handle("PUT /api/v1/alias", protect(http.HandlerFunc(h.handleUpdateAlias)))
	mux.Handle("DELETE /api/v1/alias", protect(http.HandlerFunc(h.handleDeleteAlias)))
	mux.Handle("POST /api/v1/cache/clear", protect(http.HandlerFunc(h.handleClearCache)))
	mux.Handle("POST /api/v1/s3/test", protect(http.HandlerFunc(h.handleTestS3Connection)))
	mux.Handle("POST /api/v1/photos/move", protect(http.HandlerFunc(h.handleMovePhotos)))
}

func (h *Handler) handleMovePhotos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Alias     string   `json:"alias"`
		Paths     []string `json:"paths"`
		DestAlias string   `json:"dest_alias"`
		DestPath  string   `json:"dest_path"` // Optional, relative to dest root
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Alias == "" || len(req.Paths) == 0 || req.DestAlias == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	srcProvider, ok := h.Providers[req.Alias]
	if !ok {
		http.Error(w, fmt.Sprintf("Source alias '%s' not found", req.Alias), http.StatusNotFound)
		return
	}

	destProvider, ok := h.Providers[req.DestAlias]
	if !ok {
		http.Error(w, fmt.Sprintf("Destination alias '%s' not found", req.DestAlias), http.StatusNotFound)
		return
	}

	moved := []string{}
	failed := []string{}

	for _, path := range req.Paths {
		// Calculate destination path
		// If DestPath is provided, use it (e.g. subfolder). If not, just use original filename.
		// Note: "path" might be "folder/file.jpg" or "file.jpg"
		filename := filepath.Base(path)
		destFilePath := filename
		if req.DestPath != "" {
			// Ensure destPath ends with separator or join correctly
			destFilePath = filepath.Join(req.DestPath, filename)
		}

		var err error
		if req.Alias == req.DestAlias {
			// Intra-provider move
			// Note: Provider.Move(src, dest) - dest is full path relative to root
			err = srcProvider.Move(path, destFilePath)
		} else {
			// Inter-provider move (Copy then Delete)
			reader, rErr := srcProvider.GetFileReader(path)
			if rErr != nil {
				err = fmt.Errorf("failed to read source: %v", rErr)
			} else {
				// Upload to dest
				_, uErr := destProvider.Upload(destFilePath, reader)
				reader.Close()
				if uErr != nil {
					err = fmt.Errorf("failed to upload to dest: %v", uErr)
				} else {
					// Delete from source
					if dErr := srcProvider.Delete(path); dErr != nil {
						// This is tricky, we copied but failed to delete. 
						// It's technically a "success" for move as data is safe, but effectively a copy.
						// We'll log it but consider it moved for now, or maybe mark as warning.
						// For simplicity here, we consider it moved but log error.
						log.Printf("Failed to delete source after copy %s: %v", path, dErr)
					}
				}
			}
		}

		if err != nil {
			log.Printf("Move error %s -> %s: %v", path, req.DestAlias, err)
			failed = append(failed, path)
		} else {
			moved = append(moved, path)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"moved":  moved,
		"failed": failed,
	})
}


func (h *Handler) handleGetAliases(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.Config.Aliases)
}

func (h *Handler) handleServeFile(w http.ResponseWriter, r *http.Request) {
	aliasName := r.URL.Query().Get("alias")
	path := r.URL.Query().Get("path")

	p, ok := h.Providers[aliasName]
	if !ok {
		http.Error(w, "Alias not found", http.StatusNotFound)
		return
	}

	originalURL, err := p.GetOriginalURL(path)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// If it's a URL (S3 presigned), redirect to it
	// If it's a path (Local filesystem), serve it directly
	if strings.HasPrefix(originalURL, "http://") || strings.HasPrefix(originalURL, "https://") {
		http.Redirect(w, r, originalURL, http.StatusTemporaryRedirect)
	} else {
		http.ServeFile(w, r, originalURL)
	}
}

func (h *Handler) handleGetThumbnail(w http.ResponseWriter, r *http.Request) {
    aliasName := r.URL.Query().Get("alias")
    path := r.URL.Query().Get("path")

    if aliasName == "" || path == "" {
        http.Error(w, "Missing alias or path", http.StatusBadRequest)
        return
    }

    p, ok := h.Providers[aliasName]
    if !ok {
        http.Error(w, "Alias not found", http.StatusNotFound)
        return
    }

    reader, err := p.GetThumbnail(path)
    if err != nil {
        log.Printf("Thumbnail error for %s/%s: %v", aliasName, path, err)
        http.Error(w, "Failed to get thumbnail", http.StatusInternalServerError)
        return
    }
    defer reader.(io.Closer).Close()

    w.Header().Set("Cache-Control", "public, max-age=86400")
    w.Header().Set("Content-Type", "image/jpeg")
    io.Copy(w, reader)
}

func (h *Handler) handleDeletePhoto(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	aliasName := r.URL.Query().Get("alias")
	path := r.URL.Query().Get("path")

	if aliasName == "" || path == "" {
		http.Error(w, "Missing alias or path", http.StatusBadRequest)
		return
	}

	p, ok := h.Providers[aliasName]
	if !ok {
		http.Error(w, "Alias not found", http.StatusNotFound)
		return
	}

	if err := p.Delete(path); err != nil {
		log.Printf("Delete error for %s/%s: %v", aliasName, path, err)
		http.Error(w, fmt.Sprintf("Failed to delete photo: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

func (h *Handler) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 32MB max memory
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	aliasName := r.FormValue("alias")
	if aliasName == "" {
		http.Error(w, "Missing alias", http.StatusBadRequest)
		return
	}

	p, ok := h.Providers[aliasName]
	if !ok {
		http.Error(w, "Alias not found", http.StatusNotFound)
		return
	}

	files := r.MultipartForm.File["files"]
	uploaded := []string{}
	failed := []string{}

	for _, header := range files {
		file, err := header.Open()
		if err != nil {
			failed = append(failed, header.Filename)
			continue
		}
		
		savedName, err := p.Upload(header.Filename, file)
		file.Close()
		
		if err != nil {
			log.Printf("Upload error for %s: %v", header.Filename, err)
			failed = append(failed, header.Filename)
		} else {
			uploaded = append(uploaded, savedName)
		}
	}

	response := map[string]interface{}{
		"uploaded": uploaded,
		"failed":   failed,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) handleAddAlias(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req config.Alias
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Type == "" {
		http.Error(w, "Missing required fields (name, type)", http.StatusBadRequest)
		return
	}

	// Check for duplicates
	for _, a := range h.Config.Aliases {
		if a.Name == req.Name {
			http.Error(w, "Alias name already exists", http.StatusConflict)
			return
		}
	}

	// Create provider immediately to verify configuration
	if req.Type == config.AliasTypeLocal {
		if req.Path == "" {
			http.Error(w, "Missing path for local alias", http.StatusBadRequest)
			return
		}
		p, err := provider.NewLocalProvider(req.Path)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid path: %v", err), http.StatusBadRequest)
			return
		}
		h.Providers[req.Name] = p
	} else if req.Type == config.AliasTypeS3 {
		if req.Bucket == "" || req.Endpoint == "" || req.AccessKey == "" || req.SecretKey == "" {
			http.Error(w, "Missing required S3 fields (bucket, endpoint, access_key, secret_key)", http.StatusBadRequest)
			return
		}
		// Determine SSL usage from endpoint
		useSSL := strings.HasPrefix(req.Endpoint, "https://")
		endpoint := strings.TrimPrefix(strings.TrimPrefix(req.Endpoint, "https://"), "http://")
		
		p, err := provider.NewS3Provider(provider.S3ProviderConfig{
			Endpoint:  endpoint,
			AccessKey: req.AccessKey,
			SecretKey: req.SecretKey,
			UseSSL:    useSSL,
			Bucket:    req.Bucket,
			Prefix:    req.Path, // Path is used as prefix for S3
			Region:    req.Region,
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid S3 configuration: %v", err), http.StatusBadRequest)
			return
		}
		h.Providers[req.Name] = p
	} else {
		http.Error(w, "Unknown alias type", http.StatusBadRequest)
		return
	}

	h.Config.Aliases = append(h.Config.Aliases, req)
	if err := h.Config.Save("app-config.yaml"); err != nil {
		log.Printf("Failed to save config: %v", err)
		http.Error(w, "Failed to persist config", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

func (h *Handler) handleUpdateAlias(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		OldName   string `json:"old_name"`
		NewName   string `json:"new_name"`
		Path      string `json:"path,omitempty"`
		Bucket    string `json:"bucket,omitempty"`
		Endpoint  string `json:"endpoint,omitempty"`
		Region    string `json:"region,omitempty"`
		AccessKey string `json:"access_key,omitempty"`
		SecretKey string `json:"secret_key,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.OldName == "" || req.NewName == "" {
		http.Error(w, "Missing old_name or new_name", http.StatusBadRequest)
		return
	}

	// Check if new name conflicts (except if same as old)
	if req.OldName != req.NewName {
		for _, a := range h.Config.Aliases {
			if a.Name == req.NewName {
				http.Error(w, "New alias name already exists", http.StatusConflict)
				return
			}
		}
	}

	// Find and update
	found := false
	var oldAlias config.Alias
	var aliasIndex int
	for i, a := range h.Config.Aliases {
		if a.Name == req.OldName {
			oldAlias = a
			aliasIndex = i
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "Alias not found", http.StatusNotFound)
		return
	}

	// Update fields
	h.Config.Aliases[aliasIndex].Name = req.NewName
	if req.Path != "" || oldAlias.Type == config.AliasTypeLocal {
		h.Config.Aliases[aliasIndex].Path = req.Path
	}
	if oldAlias.Type == config.AliasTypeS3 {
		if req.Bucket != "" {
			h.Config.Aliases[aliasIndex].Bucket = req.Bucket
		}
		if req.Endpoint != "" {
			h.Config.Aliases[aliasIndex].Endpoint = req.Endpoint
		}
		if req.Region != "" {
			h.Config.Aliases[aliasIndex].Region = req.Region
		}
		if req.AccessKey != "" {
			h.Config.Aliases[aliasIndex].AccessKey = req.AccessKey
		}
		if req.SecretKey != "" {
			h.Config.Aliases[aliasIndex].SecretKey = req.SecretKey
		}

		// Re-create S3 provider with new settings
		updatedAlias := h.Config.Aliases[aliasIndex]
		useSSL := strings.HasPrefix(updatedAlias.Endpoint, "https://")
		endpoint := strings.TrimPrefix(strings.TrimPrefix(updatedAlias.Endpoint, "https://"), "http://")

		p, err := provider.NewS3Provider(provider.S3ProviderConfig{
			Endpoint:  endpoint,
			AccessKey: updatedAlias.AccessKey,
			SecretKey: updatedAlias.SecretKey,
			UseSSL:    useSSL,
			Bucket:    updatedAlias.Bucket,
			Prefix:    updatedAlias.Path,
			Region:    updatedAlias.Region,
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid S3 configuration: %v", err), http.StatusBadRequest)
			return
		}
		delete(h.Providers, req.OldName)
		h.Providers[req.NewName] = p
	} else if oldAlias.Type == config.AliasTypeLocal {
		// Re-create local provider
		p, err := provider.NewLocalProvider(h.Config.Aliases[aliasIndex].Path)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid path: %v", err), http.StatusBadRequest)
			return
		}
		delete(h.Providers, req.OldName)
		h.Providers[req.NewName] = p
	} else {
		// Just update provider map key
		if p, ok := h.Providers[req.OldName]; ok {
			h.Providers[req.NewName] = p
			delete(h.Providers, req.OldName)
		}
	}

	if err := h.Config.Save("app-config.yaml"); err != nil {
		log.Printf("Failed to save config: %v", err)
		http.Error(w, "Failed to persist config", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(h.Config.Aliases[aliasIndex])
}

func (h *Handler) handleDeleteAlias(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := r.URL.Query().Get("name")
	if name == "" {
		http.Error(w, "Missing name", http.StatusBadRequest)
		return
	}

	newAliases := []config.Alias{}
	found := false
	for _, a := range h.Config.Aliases {
		if a.Name == name {
			found = true
			continue
		}
		newAliases = append(newAliases, a)
	}

	if !found {
		http.Error(w, "Alias not found", http.StatusNotFound)
		return
	}

	h.Config.Aliases = newAliases
	delete(h.Providers, name)

	if err := h.Config.Save("app-config.yaml"); err != nil {
		log.Printf("Failed to save config: %v", err)
		http.Error(w, "Failed to persist config", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

func (h *Handler) handleClearCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := thumb.ClearCache(); err != nil {
		http.Error(w, fmt.Sprintf("Failed to clear cache: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
}

func (h *Handler) handleGetPhotos(w http.ResponseWriter, r *http.Request) {
	aliasName := r.URL.Query().Get("alias")
	cursor := r.URL.Query().Get("cursor")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}

	p, ok := h.Providers[aliasName]
	if !ok {
		http.Error(w, fmt.Sprintf("Alias '%s' not found", aliasName), http.StatusNotFound)
		return
	}

	photos, nextCursor, err := p.List(cursor, limit)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list photos: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"photos":      photos,
		"next_cursor": nextCursor,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleTestS3Connection tests S3 connection without saving
func (h *Handler) handleTestS3Connection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Endpoint  string `json:"endpoint"`
		Bucket    string `json:"bucket"`
		AccessKey string `json:"access_key"`
		SecretKey string `json:"secret_key"`
		Region    string `json:"region"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Endpoint == "" || req.Bucket == "" || req.AccessKey == "" || req.SecretKey == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Parse endpoint
	useSSL := strings.HasPrefix(req.Endpoint, "https://")
	endpoint := strings.TrimPrefix(strings.TrimPrefix(req.Endpoint, "https://"), "http://")

	// Try to create S3 provider (this verifies the bucket exists)
	_, err := provider.NewS3Provider(provider.S3ProviderConfig{
		Endpoint:  endpoint,
		AccessKey: req.AccessKey,
		SecretKey: req.SecretKey,
		UseSSL:    useSSL,
		Bucket:    req.Bucket,
		Region:    req.Region,
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "连接成功",
	})
}
