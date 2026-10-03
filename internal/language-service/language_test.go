package languageService

import (
	excelLanguage "Cyrene-launcher/pkg/language-patch/excel-language"
	"testing"
)

func TestSupportsTextLanguageRequiresMatchingGameArea(t *testing.T) {
	area := "os"
	otherArea := "cn"
	language := "th"
	rows := []excelLanguage.LanguageRow{
		{Area: &area, LanguageList: []string{"en", "th"}},
		{Area: &otherArea, LanguageList: []string{"en"}},
	}

	if !supportsTextLanguage(rows, "os", language) {
		t.Fatal("expected Thai to be available for the OS game area")
	}
	if supportsTextLanguage(rows, "cn", language) {
		t.Fatal("Thai must not be reported as available for an area without Thai data")
	}
}
