//go:build !windows

package hiddenexec

import "os/exec"

func HideWindow(_ *exec.Cmd) {}
