package languageService

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

//go:embed thai_text.py
var thaiTextScript []byte

func (l *LanguageService) BuildThaiText(betaRoot, liveRoot, dispatchRoot string) (bool, string) {
	return runThaiTextTool("build", betaRoot, liveRoot, dispatchRoot)
}

func (l *LanguageService) RestoreThaiText(betaRoot, dispatchRoot string) (bool, string) {
	return runThaiTextTool("restore", betaRoot, "", dispatchRoot)
}

func runThaiTextTool(action, betaRoot, liveRoot, dispatchRoot string) (bool, string) {
	if action != "build" && action != "restore" {
		return false, "unsupported Thai text action"
	}
	if strings.TrimSpace(betaRoot) == "" || strings.TrimSpace(dispatchRoot) == "" {
		return false, "Beta game folder and server folder are required"
	}
	if action == "build" && strings.TrimSpace(liveRoot) == "" {
		return false, "select the Live game folder that has Thai and English text downloaded"
	}
	if runtime.GOOS == "windows" {
		if output, err := exec.Command("tasklist", "/FI", "IMAGENAME eq StarRail.exe").Output(); err == nil && strings.Contains(strings.ToLower(string(output)), "starrail.exe") {
			return false, "close StarRail before building or restoring Thai text"
		}
	}

	betaRoot, err := filepath.Abs(filepath.Clean(betaRoot))
	if err != nil {
		return false, fmt.Errorf("resolve Beta folder: %w", err).Error()
	}
	dispatchRoot, err = filepath.Abs(filepath.Clean(dispatchRoot))
	if err != nil {
		return false, fmt.Errorf("resolve server folder: %w", err).Error()
	}
	if action == "build" {
		liveRoot, err = filepath.Abs(filepath.Clean(liveRoot))
		if err != nil {
			return false, fmt.Errorf("resolve Live folder: %w", err).Error()
		}
		if _, err := os.Stat(filepath.Join(dispatchRoot, "versions.json")); err != nil {
			return false, fmt.Errorf("server version data not found in %s: %w", dispatchRoot, err).Error()
		}
	}

	python, err := exec.LookPath("python")
	pythonArgs := []string{}
	if err != nil {
		python, err = exec.LookPath("py")
		if err != nil {
			return false, "Python 3 was not found; install Python and add it to PATH"
		}
		pythonArgs = append(pythonArgs, "-3")
	}

	temporaryScript, err := os.CreateTemp("", "cyrene-thai-text-*.py")
	if err != nil {
		return false, fmt.Errorf("create Thai text tool: %w", err).Error()
	}
	scriptPath := temporaryScript.Name()
	defer os.Remove(scriptPath)
	if _, err := temporaryScript.Write(thaiTextScript); err != nil {
		temporaryScript.Close()
		return false, fmt.Errorf("write Thai text tool: %w", err).Error()
	}
	if err := temporaryScript.Close(); err != nil {
		return false, fmt.Errorf("close Thai text tool: %w", err).Error()
	}

	args := append(pythonArgs, scriptPath, action, "--beta", betaRoot, "--dispatch-root", dispatchRoot)
	if action == "build" {
		args = append(args, "--live", liveRoot)
	}
	command := exec.Command(python, args...)
	output, err := command.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if len(message) > 6000 {
			message = message[len(message)-6000:]
		}
		return false, fmt.Errorf("Thai text %s failed: %w\n%s", action, err, message).Error()
	}
	if message == "" {
		message = "Thai text " + action + " completed"
	}
	return true, message
}
