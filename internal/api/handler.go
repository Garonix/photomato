package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"

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
	mux.HandleFunc("GET /api/v1/aliases", h.handleGetAliases)
	mux.HandleFunc("GET /api/v1/photos", h.handleGetPhotos)
	// mux.HandleFunc("POST /api/v1/operate", h.handleOperate)
	mux.HandleFunc("GET /api/v1/file", h.handleServeFile)
	mux.HandleFunc("GET /api/v1/thumb", h.handleGetThumbnail)
	mux.HandleFunc("DELETE /api/v1/photo", h.handleDeletePhoto)
	mux.HandleFunc("POST /api/v1/upload", h.handleUpload)
	mux.HandleFunc("POST /api/v1/alias", h.handleAddAlias)
	mux.HandleFunc("PUT /api/v1/alias", h.handleUpdateAlias)
	mux.HandleFunc("DELETE /api/v1/alias", h.handleDeleteAlias)
	mux.HandleFunc("POST /api/v1/cache/clear", h.handleClearCache)
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

	// For local provider, we get the absolute path and serve it
	// For S3, we would redirect to the presigned URL
	
	originalURL, err := p.GetOriginalURL(path)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// If it's a URL (S3), redirect
	// If it's a path (Local), serve it
	// Simple heuristic: check if starts with http
	// In production code verify interface type or use specific method
	
	// Since LocalProvider returns absolute path:
	http.ServeFile(w, r, originalURL)
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

	if req.Name == "" || req.Type == "" || req.Path == "" {
		http.Error(w, "Missing required fields (name, type, path)", http.StatusBadRequest)
		return
	}

	// Check for duplicates
	for _, a := range h.Config.Aliases {
		if a.Name == req.Name {
			http.Error(w, "Alias name already exists", http.StatusConflict)
			return
		}
	}

	// Create provider immediately to verify path
	if req.Type == config.AliasTypeLocal {
		p, err := provider.NewLocalProvider(req.Path)
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid path: %v", err), http.StatusBadRequest)
			return
		}
		h.Providers[req.Name] = p
	} else {
		// TODO: S3 verification
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
		OldName string `json:"old_name"`
		NewName string `json:"new_name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.OldName == "" || req.NewName == "" {
		http.Error(w, "Missing old_name or new_name", http.StatusBadRequest)
		return
	}

	// Check if new name exists
	for _, a := range h.Config.Aliases {
		if a.Name == req.NewName {
			http.Error(w, "New alias name already exists", http.StatusConflict)
			return
		}
	}

	// Find and update
	found := false
	for i, a := range h.Config.Aliases {
		if a.Name == req.OldName {
			h.Config.Aliases[i].Name = req.NewName
			// Update Provider Map
			if p, ok := h.Providers[req.OldName]; ok {
				h.Providers[req.NewName] = p
				delete(h.Providers, req.OldName)
			}
			found = true
			break
		}
	}

	if !found {
		http.Error(w, "Alias not found", http.StatusNotFound)
		return
	}

	if err := h.Config.Save("app-config.yaml"); err != nil {
		log.Printf("Failed to save config: %v", err)
		http.Error(w, "Failed to persist config", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
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
