package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type AliasType string

const (
	AliasTypeLocal AliasType = "local"
	AliasTypeS3    AliasType = "s3"
)

type Alias struct {
	Name      string    `yaml:"name" json:"name"`
	Type      AliasType `yaml:"type" json:"type"`
	Path      string    `yaml:"path,omitempty" json:"path,omitempty"`
	Bucket    string    `yaml:"bucket,omitempty" json:"bucket,omitempty"`
	Endpoint  string    `yaml:"endpoint,omitempty" json:"endpoint,omitempty"`
	Region    string    `yaml:"region,omitempty" json:"region,omitempty"`
	AccessKey string    `yaml:"access_key,omitempty" json:"access_key,omitempty"`
	SecretKey string    `yaml:"secret_key,omitempty" json:"secret_key,omitempty"`
}

type Config struct {
	Port    int     `yaml:"port" json:"port"`
	Aliases []Alias `yaml:"aliases" json:"aliases"`
}

func Load(path string) (*Config, error) {
	// Default config
	cfg := &Config{
		Port: 8080,
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil // Return default if no file
		}
		return nil, err
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Save(path string) error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
