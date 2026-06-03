package imap

import (
	"fmt"
	"io"
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

// ListMessages fetches a page of message summaries from the given folder.
// UIDs are sorted in descending order (newest first).
func ListMessages(conn *UserConnection, folder string, page, pageSize int) ([]MessageSummary, int, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, true); err != nil {
		return nil, 0, fmt.Errorf("select folder %q: %w", folder, err)
	}

	// Get all UIDs
	seqset, _ := goimap.ParseSeqSet("1:*")
	uids, err := conn.Client.UidSearch(&goimap.SearchCriteria{SeqNum: seqset})
	if err != nil {
		return nil, 0, fmt.Errorf("search uids: %w", err)
	}

	total := len(uids)
	if total == 0 {
		return []MessageSummary{}, 0, nil
	}

	// Sort descending (newest first)
	for i, j := 0, len(uids)-1; i < j; i, j = i+1, j-1 {
		uids[i], uids[j] = uids[j], uids[i]
	}

	// Paginate
	start := page * pageSize
	if start >= total {
		return []MessageSummary{}, total, nil
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	pageUIDs := uids[start:end]

	// Build seqset for the page
	pageSeq := new(goimap.SeqSet)
	for _, uid := range pageUIDs {
		pageSeq.AddNum(uid)
	}

	items := []goimap.FetchItem{
		goimap.FetchUid,
		goimap.FetchEnvelope,
		goimap.FetchFlags,
		goimap.FetchRFC822Size,
		goimap.FetchInternalDate,
	}

	ch := make(chan *goimap.Message, 10)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.UidFetch(pageSeq, items, ch)
	}()

	var summaries []MessageSummary
	for msg := range ch {
		s := MessageSummary{
			UID:  msg.Uid,
			Size: msg.Size,
		}
		if msg.Envelope != nil {
			if msg.Envelope.From != nil && len(msg.Envelope.From) > 0 {
				s.From = formatAddress(msg.Envelope.From[0])
			}
			if msg.Envelope.To != nil && len(msg.Envelope.To) > 0 {
				s.To = formatAddresses(msg.Envelope.To)
			}
			s.Subject = msg.Envelope.Subject
			s.Date = msg.Envelope.Date
		}
		if msg.Flags != nil {
			s.Flags = ParseMessageFlags(msg.Flags)
		}
		if !msg.InternalDate.IsZero() {
			s.Date = msg.InternalDate
		}
		summaries = append(summaries, s)
	}

	if err := <-done; err != nil {
		return nil, 0, fmt.Errorf("fetch messages: %w", err)
	}

	return summaries, total, nil
}

// GetMessage fetches the full RFC822 body of a message by UID.
func GetMessage(conn *UserConnection, folder string, uid uint32) ([]byte, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, false); err != nil {
		return nil, fmt.Errorf("select folder %q: %w", folder, err)
	}

	seq := new(goimap.SeqSet)
	seq.AddNum(uid)

	ch := make(chan *goimap.Message, 1)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.UidFetch(seq, []goimap.FetchItem{goimap.FetchRFC822}, ch)
	}()

	var literal goimap.Literal
	for msg := range ch {
		literal = msg.GetBody(&goimap.BodySectionName{})
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("fetch message: %w", err)
	}

	if literal == nil {
		return nil, fmt.Errorf("message body not found")
	}

	body, err := io.ReadAll(literal)
	if err != nil {
		return nil, fmt.Errorf("read message body: %w", err)
	}

	return body, nil
}

// UpdateFlags sets or clears message flags.
func UpdateFlags(conn *UserConnection, folder string, uids []uint32, flag string, value bool) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, false); err != nil {
		return fmt.Errorf("select folder %q: %w", folder, err)
	}

	seq := new(goimap.SeqSet)
	for _, uid := range uids {
		seq.AddNum(uid)
	}

	flags := []interface{}{flag}
	var item goimap.StoreItem
	if value {
		item = goimap.AddFlags
	} else {
		item = goimap.RemoveFlags
	}

	if err := conn.Client.UidStore(seq, item, flags, nil); err != nil {
		return fmt.Errorf("store flags: %w", err)
	}
	return nil
}

// DeleteMessage marks a message as deleted and expunges it.
func DeleteMessage(conn *UserConnection, folder string, uid uint32) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, false); err != nil {
		return fmt.Errorf("select folder %q: %w", folder, err)
	}

	seq := new(goimap.SeqSet)
	seq.AddNum(uid)

	if err := conn.Client.UidStore(seq, goimap.AddFlags, []interface{}{`\Deleted`}, nil); err != nil {
		return fmt.Errorf("mark deleted: %w", err)
	}

	if err := conn.Client.Expunge(nil); err != nil {
		return fmt.Errorf("expunge: %w", err)
	}
	return nil
}

// MoveMessage copies a message to another folder then deletes the original.
func MoveMessage(conn *UserConnection, folder string, uid uint32, destFolder string) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, false); err != nil {
		return fmt.Errorf("select folder %q: %w", folder, err)
	}

	seq := new(goimap.SeqSet)
	seq.AddNum(uid)

	if err := conn.Client.UidCopy(seq, destFolder); err != nil {
		return fmt.Errorf("copy to %q: %w", destFolder, err)
	}

	if err := conn.Client.UidStore(seq, goimap.AddFlags, []interface{}{`\Deleted`}, nil); err != nil {
		return fmt.Errorf("mark deleted: %w", err)
	}

	if err := conn.Client.Expunge(nil); err != nil {
		return fmt.Errorf("expunge: %w", err)
	}
	return nil
}

func formatAddress(addr *goimap.Address) string {
	if addr == nil {
		return ""
	}
	if addr.PersonalName != "" {
		return fmt.Sprintf("%s <%s@%s>", addr.PersonalName, addr.MailboxName, addr.HostName)
	}
	return fmt.Sprintf("%s@%s", addr.MailboxName, addr.HostName)
}

func formatAddresses(addrs []*goimap.Address) string {
	if len(addrs) == 0 {
		return ""
	}
	result := formatAddress(addrs[0])
	for _, a := range addrs[1:] {
		result += ", " + formatAddress(a)
	}
	return result
}

// SearchMessages searches a folder with the given criteria and returns
// summaries of matching messages.
func SearchMessages(conn *UserConnection, folder string, query SearchQuery) ([]MessageSummary, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, true); err != nil {
		return nil, fmt.Errorf("select folder %q: %w", folder, err)
	}

	criteria := goimap.NewSearchCriteria()

	if query.Text != "" {
		criteria.Text = []string{query.Text}
	}
	if query.From != "" {
		criteria.Header.Set("From", query.From)
	}
	if query.To != "" {
		criteria.Header.Set("To", query.To)
	}
	if query.Subject != "" {
		criteria.Header.Set("Subject", query.Subject)
	}
	if query.Since != nil {
		criteria.Since = *query.Since
	}
	if query.Before != nil {
		criteria.Before = *query.Before
	}
	if query.Unseen != nil {
		if *query.Unseen {
			criteria.WithoutFlags = []string{`\Seen`}
		} else {
			criteria.WithFlags = []string{`\Seen`}
		}
	}
	if query.Flagged != nil {
		if *query.Flagged {
			criteria.WithFlags = append(criteria.WithFlags, `\Flagged`)
		} else {
			criteria.WithoutFlags = append(criteria.WithoutFlags, `\Flagged`)
		}
	}

	uids, err := conn.Client.UidSearch(criteria)
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}

	if len(uids) == 0 {
		return []MessageSummary{}, nil
	}

	// Sort descending
	for i, j := 0, len(uids)-1; i < j; i, j = i+1, j-1 {
		uids[i], uids[j] = uids[j], uids[i]
	}

	seq := new(goimap.SeqSet)
	for _, uid := range uids {
		seq.AddNum(uid)
	}

	items := []goimap.FetchItem{
		goimap.FetchUid,
		goimap.FetchEnvelope,
		goimap.FetchFlags,
		goimap.FetchRFC822Size,
		goimap.FetchInternalDate,
	}

	ch := make(chan *goimap.Message, 10)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.UidFetch(seq, items, ch)
	}()

	var summaries []MessageSummary
	for msg := range ch {
		s := MessageSummary{
			UID:  msg.Uid,
			Size: msg.Size,
		}
		if msg.Envelope != nil {
			if msg.Envelope.From != nil && len(msg.Envelope.From) > 0 {
				s.From = formatAddress(msg.Envelope.From[0])
			}
			if msg.Envelope.To != nil && len(msg.Envelope.To) > 0 {
				s.To = formatAddresses(msg.Envelope.To)
			}
			s.Subject = msg.Envelope.Subject
			s.Date = msg.Envelope.Date
		}
		if msg.Flags != nil {
			s.Flags = ParseMessageFlags(msg.Flags)
		}
		if !msg.InternalDate.IsZero() {
			s.Date = msg.InternalDate
		}
		summaries = append(summaries, s)
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}

	return summaries, nil
}
