package imap

import "testing"

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
