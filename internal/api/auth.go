package api

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	AuthCookieName = "auth_token"
	// A simple salt to prevent rainbow table attacks on the cookie value if leaked, 
	// though for this simple implementation it's just a basic meaningful string.
	AuthSalt       = "photomato_secure_salt_" 
)

// getPassword returns the configured password from env
func getPassword() string {
	if os.Getenv("PHOTOMATO_AUTH_ENABLED") != "true" {
		return ""
	}
	return os.Getenv("PHOTOMATO_PASSWORD")
}

// generateToken creates a simple token based on the password
// In a real app, this should be a proper session ID or JWT. 
// For this simple single-password app, a hash of the password suffices to verify knowledge.
func generateToken(password string) string {
	hash := sha256.Sum256([]byte(AuthSalt + password))
	return hex.EncodeToString(hash[:])
}

// AuthMiddleware wraps a handler and checks for authentication if a password is set
func (h *Handler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		password := getPassword()
		
		// If no password configured, everything is public
		if password == "" {
			next.ServeHTTP(w, r)
			return
		}

		// Check for cookie
		cookie, err := r.Cookie(AuthCookieName)
		if err != nil || cookie.Value != generateToken(password) {
			// Allow public access to auth endpoints and maybe static assets if needed,
			// but usually the frontend static assets are served differently.
			// Here we are wrapping API routes.
			// We must allow /api/v1/auth/* explicitly, but since we register them separately
			// and wrap the *mux*, we can't easily distinguish inside middleware unless checking path.
			// BETTER APPROACH: Only wrap specific routes or check path here.
			
			path := r.URL.Path
			if strings.HasPrefix(path, "/api/v1/auth/") || strings.HasPrefix(path, "/api/v1/file") || strings.HasPrefix(path, "/api/v1/thumb") {
				// Wait, file and thumb should probably be protected too? 
				// The prompt says "verify password". Usually that means viewing photos too.
				// But let's allow auth endpoints.
				if strings.HasPrefix(path, "/api/v1/auth/") {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// handleLogin handles the login request
func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	configuredPass := getPassword()
	if configuredPass == "" {
		// If no password set, login is always successful (or unnecessary)
		// but techincally we shouldn't be here if checks are correct.
		w.WriteHeader(http.StatusOK)
		return
	}

	if req.Password != configuredPass {
		// Artificial delay to prevent timing attacks / brute force
		time.Sleep(500 * time.Millisecond)
		http.Error(w, "Invalid password", http.StatusUnauthorized)
		return
	}

	// Set cookie
	token := generateToken(configuredPass)
	http.SetCookie(w, &http.Cookie{
		Name:     AuthCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   86400 * 30, // 30 days
	})

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// handleAuthCheck checks if the user is authenticated
func (h *Handler) handleAuthCheck(w http.ResponseWriter, r *http.Request) {
	// Logic is similar to middleware but returns JSON status
	password := getPassword()
	if password == "" {
		// No password needed
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{"authenticated": true, "public": true})
		return
	}

	cookie, err := r.Cookie(AuthCookieName)
	if err != nil || cookie.Value != generateToken(password) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]bool{"authenticated": false})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"authenticated": true})
}
