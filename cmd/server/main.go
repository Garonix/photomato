package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

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
		fmt.Printf("- [%s] %s (%s)\n", a.Type, a.Name, a.Path)
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
			log.Printf("S3 provider not yet implemented for '%s'", alias.Name)
			// TODO: S3 implementation
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
