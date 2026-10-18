package fsService

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"Cyrene-launcher/pkg/constant"
)

const uidCustomFileName = "UID_Custom.json"

type UIDCustomConfig struct {
	BetaText    string `json:"beta_text"`
	VersionText string `json:"version_text"`
}

func defaultUIDCustomConfig() UIDCustomConfig {
	return UIDCustomConfig{
		BetaText:    `<color=#0bffe0>Horoyoi-san ඞ</color> | <color=#0b3cff>Aeon</color> ★ <color=#ff0000>Aha</color>`,
		VersionText: `เวอร์ชันปัจจุบันคือเวอร์ชันทดสอบ ซึ่งไม่ได้บ่งบอกถึงคุณภาพสุดท้ายของเกม <color=#FF0000>Ho</color><color=#FF7F00>nk</color><color=#FFFF00>ai</color> <color=#00FF00>St</color><color=#0000FF>ar</color> <color=#4B0082>Gay</color>`,
	}
}

func uidCustomPath() string {
	return filepath.Join(constant.ServerStorageUrl, uidCustomFileName)
}

func (f *FSService) ReadUIDCustom() (UIDCustomConfig, error) {
	path := uidCustomPath()
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		config := defaultUIDCustomConfig()
		if err := writeUIDCustom(path, config); err != nil {
			return UIDCustomConfig{}, err
		}
		return config, nil
	}
	if err != nil {
		return UIDCustomConfig{}, fmt.Errorf("read %s: %w", path, err)
	}

	config := defaultUIDCustomConfig()
	if err := json.Unmarshal(data, &config); err != nil {
		return UIDCustomConfig{}, fmt.Errorf("parse %s: %w", path, err)
	}
	return config, nil
}

func (f *FSService) SaveUIDCustom(config UIDCustomConfig) error {
	return writeUIDCustom(uidCustomPath(), config)
}

func writeUIDCustom(path string, config UIDCustomConfig) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create server directory: %w", err)
	}
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("serialize UID custom settings: %w", err)
	}
	if err := os.WriteFile(path, append(data, '\n'), 0644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}
