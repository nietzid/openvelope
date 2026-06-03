package imap

import (
	"fmt"
	"strings"
	"time"

	goimap "github.com/emersion/go-imap"
)

type MessageFlags struct {
	Seen     bool `json:"seen"`
	Flagged  bool `json:"flagged"`
	Answered bool `json:"answered"`
	Draft    bool `json:"draft"`
	Deleted  bool `json:"deleted"`
}

type MessageSummary struct {
	UID       uint32       `json:"uid"`
	From      string       `json:"from"`
	To        string       `json:"to"`
	Subject   string       `json:"subject"`
	Date      time.Time    `json:"date"`
	Size      uint32       `json:"size"`
	Flags     MessageFlags `json:"flags"`
	HasAttach bool         `json:"has_attach"`
	Preview   string       `json:"preview"`
}

type FolderInfo struct {
	Name      string `json:"name"`
	Count     uint32 `json:"count"`
	Unseen    uint32 `json:"unseen"`
	Delimiter string `json:"delimiter"`
}

type SearchQuery struct {
	Text    string
	From    string
	To      string
	Subject string
	Since   *time.Time
	Before  *time.Time
	Unseen  *bool
	Flagged *bool
}

func ParseMessageFlags(flags []string) MessageFlags {
	mf := MessageFlags{}
	for _, f := range flags {
		switch f {
		case `\Seen`:
			mf.Seen = true
		case `\Flagged`:
			mf.Flagged = true
		case `\Answered`:
			mf.Answered = true
		case `\Draft`:
			mf.Draft = true
		case `\Deleted`:
			mf.Deleted = true
		}
	}
	return mf
}

func BuildSearchCriteria(q SearchQuery) string {
	var parts []string
	if q.Text != "" {
		parts = append(parts, fmt.Sprintf(`TEXT "%s"`, q.Text))
	}
	if q.From != "" {
		parts = append(parts, fmt.Sprintf(`FROM "%s"`, q.From))
	}
	if q.To != "" {
		parts = append(parts, fmt.Sprintf(`TO "%s"`, q.To))
	}
	if q.Subject != "" {
		parts = append(parts, fmt.Sprintf(`SUBJECT "%s"`, q.Subject))
	}
	if q.Since != nil {
		parts = append(parts, fmt.Sprintf(`SINCE %s`, q.Since.Format("02-Jan-2006")))
	}
	if q.Before != nil {
		parts = append(parts, fmt.Sprintf(`BEFORE %s`, q.Before.Format("02-Jan-2006")))
	}
	if q.Unseen != nil && *q.Unseen {
		parts = append(parts, "UNSEEN")
	}
	if q.Flagged != nil && *q.Flagged {
		parts = append(parts, "FLAGGED")
	}
	return strings.Join(parts, " ")
}

func ListFolders(conn *UserConnection) ([]FolderInfo, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	mailboxes := make(chan *goimap.MailboxInfo, 10)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.List("", "*", mailboxes)
	}()

	var folders []FolderInfo
	for mb := range mailboxes {
		folders = append(folders, FolderInfo{
			Name:      mb.Name,
			Delimiter: string(mb.Delimiter),
		})
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("list folders: %w", err)
	}
	return folders, nil
}

func SelectFolder(conn *UserConnection, folder string) (*goimap.MailboxStatus, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	status, err := conn.Client.Select(folder, false)
	if err != nil {
		return nil, fmt.Errorf("select folder %q: %w", folder, err)
	}
	return status, nil
}

func CreateFolder(conn *UserConnection, name string) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if err := conn.Client.Create(name); err != nil {
		return fmt.Errorf("create folder %q: %w", name, err)
	}
	return nil
}

func DeleteFolder(conn *UserConnection, name string) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if err := conn.Client.Delete(name); err != nil {
		return fmt.Errorf("delete folder %q: %w", name, err)
	}
	return nil
}

func RenameFolder(conn *UserConnection, oldName, newName string) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if err := conn.Client.Rename(oldName, newName); err != nil {
		return fmt.Errorf("rename folder %q to %q: %w", oldName, newName, err)
	}
	return nil
}
