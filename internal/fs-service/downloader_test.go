package fsService

import (
	"context"
	"testing"
)

func TestDownloaderControlsPauseResumeAndCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	service := &FSService{downloadCancel: cancel}

	if ok, err := service.PauseDownloader(); err != nil || !ok {
		t.Fatalf("PauseDownloader() = (%t, %v)", ok, err)
	}
	if ok, err := service.ResumeDownloader(); err != nil || !ok {
		t.Fatalf("ResumeDownloader() = (%t, %v)", ok, err)
	}
	if ok, err := service.CancelDownloader(); err != nil || !ok {
		t.Fatalf("CancelDownloader() = (%t, %v)", ok, err)
	}
	if ctx.Err() != context.Canceled {
		t.Fatalf("download context error = %v, want canceled", ctx.Err())
	}
}

func TestDownloaderControlsRequireActiveDownload(t *testing.T) {
	service := &FSService{}
	controls := []struct {
		name string
		call func() (bool, error)
	}{
		{name: "pause", call: service.PauseDownloader},
		{name: "resume", call: service.ResumeDownloader},
		{name: "cancel", call: service.CancelDownloader},
	}

	for _, control := range controls {
		t.Run(control.name, func(t *testing.T) {
			success, err := control.call()
			if err == nil {
				t.Fatal("control succeeded without an active download")
			}
			if success {
				t.Fatal("control reported success without an active download")
			}
		})
	}
}
