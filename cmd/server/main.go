package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"strings"

	"photomato/internal/api"
	"photomato/internal/config"
	"photomato/internal/provider"
)

func main() {
	configPath := flag.String("config", "app-config.yaml", "Path to configuration file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	fmt.Printf("Photomato started on port %d with %d aliases\n", cfg.Port, len(cfg.Aliases))
	for _, a := range cfg.Aliases {
		if a.Type == config.AliasTypeLocal {
			fmt.Printf("- [%s] %s (%s)\n", a.Type, a.Name, a.Path)
		} else {
			fmt.Printf("- [%s] %s (%s/%s)\n", a.Type, a.Name, a.Endpoint, a.Bucket)
		}
	}

	// Initialize Providers
	providers := make(api.ProviderMap)
	for _, alias := range cfg.Aliases {
		switch alias.Type {
		case config.AliasTypeLocal:
			p, err := provider.NewLocalProvider(alias.Path)
			if err != nil {
				log.Printf("Failed to create local provider for '%s': %v", alias.Name, err)
				continue
			}
			providers[alias.Name] = p
		case config.AliasTypeS3:
			useSSL := strings.HasPrefix(alias.Endpoint, "https://")
			endpoint := strings.TrimPrefix(strings.TrimPrefix(alias.Endpoint, "https://"), "http://")
			
			p, err := provider.NewS3Provider(provider.S3ProviderConfig{
				Endpoint:  endpoint,
				AccessKey: alias.AccessKey,
				SecretKey: alias.SecretKey,
				UseSSL:    useSSL,
				Bucket:    alias.Bucket,
				Prefix:    alias.Path, // Path is used as prefix
				Region:    alias.Region,
			})
			if err != nil {
				log.Printf("Failed to create S3 provider for '%s': %v", alias.Name, err)
				continue
			}
			providers[alias.Name] = p
			log.Printf("S3 provider '%s' connected to %s/%s", alias.Name, alias.Endpoint, alias.Bucket)
		}
	}

	// Initialize Handlers
	h := api.NewHandler(cfg, providers)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	log.Printf("Starting server on :%d", cfg.Port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", cfg.Port), mux); err != nil {
		log.Fatal(err)
	}
}
