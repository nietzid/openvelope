package imap

import (
	"testing"
	"time"

	goimap "github.com/emersion/go-imap"
)

func TestParseMessageFlags(t *testing.T) {
	tests := []struct {
		flags []string
		want  MessageFlags
	}{
		{[]string{`\Seen`, `\Flagged`}, MessageFlags{Seen: true, Flagged: true}},
		{[]string{`\Seen`}, MessageFlags{Seen: true, Flagged: false}},
		{[]string{}, MessageFlags{Seen: false, Flagged: false}},
	}

	for _, tt := range tests {
		got := ParseMessageFlags(tt.flags)
		if got.Seen != tt.want.Seen || got.Flagged != tt.want.Flagged {
			t.Errorf("ParseMessageFlags(%v) = %+v, want %+v", tt.flags, got, tt.want)
		}
	}
}

func TestBuildSearchCriteria(t *testing.T) {
	tests := []struct {
		query SearchQuery
		want  string
	}{
		{SearchQuery{Text: "hello"}, `TEXT "hello"`},
		{SearchQuery{From: "john@example.com"}, `FROM "john@example.com"`},
		{SearchQuery{Text: "hello", From: "john@example.com"}, `TEXT "hello" FROM "john@example.com"`},
	}

	for _, tt := range tests {
		got := BuildSearchCriteria(tt.query)
		if got != tt.want {
			t.Errorf("BuildSearchCriteria(%+v) = %q, want %q", tt.query, got, tt.want)
		}
	}
}

func TestHeaderFieldsSectionFetchItem(t *testing.T) {
	section := headerFieldsSection("References", "In-Reply-To")

	got := section.FetchItem()
	want := goimap.FetchItem("BODY.PEEK[HEADER.FIELDS (References In-Reply-To)]")
	if got != want {
		t.Fatalf("headerFieldsSection fetch item = %q, want %q", got, want)
	}
}

func TestSortMessageSummariesNewestFirst(t *testing.T) {
	oldest := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	newest := time.Date(2026, 1, 3, 9, 0, 0, 0, time.UTC)
	middle := time.Date(2026, 1, 2, 9, 0, 0, 0, time.UTC)

	messages := []MessageSummary{
		{UID: 10, Date: oldest},
		{UID: 20, Date: newest},
		{UID: 30, Date: middle},
		{UID: 40, Date: newest},
	}

	sortMessageSummariesNewestFirst(messages)

	got := []uint32{messages[0].UID, messages[1].UID, messages[2].UID, messages[3].UID}
	want := []uint32{40, 20, 30, 10}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("sorted UIDs = %v, want %v", got, want)
		}
	}
}

func TestResolveSentFolder(t *testing.T) {
	tests := []struct {
		name    string
		folders []FolderInfo
		want    string
	}{
		{
			name:    "prefers exact Sent folder",
			folders: []FolderInfo{{Name: "INBOX"}, {Name: "Sent"}, {Name: "[Gmail]/Sent Mail"}},
			want:    "Sent",
		},
		{
			name:    "uses Gmail sent folder",
			folders: []FolderInfo{{Name: "INBOX"}, {Name: "[Gmail]/Sent Mail"}},
			want:    "[Gmail]/Sent Mail",
		},
		{
			name:    "falls back to common suffix",
			folders: []FolderInfo{{Name: "INBOX"}, {Name: "Archive"}, {Name: "Mail/Sent"}},
			want:    "Mail/Sent",
		},
		{
			name:    "defaults to Sent",
			folders: []FolderInfo{{Name: "INBOX"}, {Name: "Archive"}},
			want:    "Sent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ResolveSentFolder(tt.folders); got != tt.want {
				t.Fatalf("ResolveSentFolder() = %q, want %q", got, tt.want)
			}
		})
	}
}
