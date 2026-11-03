//go:build windows

package hiddenexec

import (
	"os/exec"

	"golang.org/x/sys/windows"
)

func HideWindow(command *exec.Cmd) {
	command.SysProcAttr = &windows.SysProcAttr{
		HideWindow:    true,
		CreationFlags: windows.CREATE_NO_WINDOW,
	}
}
