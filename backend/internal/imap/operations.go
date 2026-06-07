package imap

import (
	"bytes"
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
	UID         uint32       `json:"uid"`
	From        string       `json:"from"`
	To          string       `json:"to"`
	Subject     string       `json:"subject"`
	Date        time.Time    `json:"date"`
	Size        uint32       `json:"size"`
	Flags       MessageFlags `json:"flags"`
	HasAttach   bool         `json:"has_attach"`
	Preview     string       `json:"preview"`
	ThreadID    string       `json:"thread_id,omitempty"`
	ThreadCount int          `json:"thread_count,omitempty"`
}

type FolderInfo struct {
	Name      string `json:"name"`
	Count     uint32 `json:"count"`
	Unseen    uint32 `json:"unseen"`
	Delimiter string `json:"delimiter"`
}

type MessageHeaders struct {
	UID        uint32       `json:"uid"`
	From       string       `json:"from"`
	To         string       `json:"to"`
	Cc         string       `json:"cc"`
	Subject    string       `json:"subject"`
	Date       time.Time    `json:"date"`
	MessageID  string       `json:"message_id"`
	InReplyTo  string       `json:"in_reply_to"`
	References string       `json:"references"`
	Flags      MessageFlags `json:"flags"`
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

type AttachmentInfo struct {
	PartID      string `json:"part_id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        uint32 `json:"size"`
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

func headerFieldsSection(fields ...string) *goimap.BodySectionName {
	return &goimap.BodySectionName{
		BodyPartName: goimap.BodyPartName{
			Specifier: goimap.HeaderSpecifier,
			Fields:    fields,
		},
		Peek: true,
	}
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

func ResolveSentFolder(folders []FolderInfo) string {
	preferred := []string{
		"Sent",
		"Sent Mail",
		"[Gmail]/Sent Mail",
		"INBOX.Sent",
		"INBOX/Sent",
		"Sent Items",
	}

	byLower := make(map[string]string, len(folders))
	for _, folder := range folders {
		byLower[strings.ToLower(folder.Name)] = folder.Name
	}

	for _, name := range preferred {
		if folder, ok := byLower[strings.ToLower(name)]; ok {
			return folder
		}
	}

	for _, folder := range folders {
		lower := strings.ToLower(folder.Name)
		if strings.HasSuffix(lower, "/sent") ||
			strings.HasSuffix(lower, ".sent") ||
			strings.Contains(lower, "sent mail") ||
			strings.Contains(lower, "sent items") {
			return folder.Name
		}
	}

	return "Sent"
}

func AppendMessage(conn *UserConnection, folder string, raw []byte, flags []string, date time.Time) error {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if err := conn.Client.Append(folder, flags, date, bytes.NewReader(raw)); err != nil {
		return fmt.Errorf("append message to %q: %w", folder, err)
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

	// Fetch headers for threading (References, In-Reply-To)
	threadSection := headerFieldsSection("References", "In-Reply-To")

	items := []goimap.FetchItem{
		goimap.FetchUid,
		goimap.FetchEnvelope,
		goimap.FetchFlags,
		goimap.FetchRFC822Size,
		goimap.FetchInternalDate,
		threadSection.FetchItem(),
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
		// Extract thread_id from References or In-Reply-To headers
		if literal := msg.GetBody(threadSection); literal != nil {
			if data, err := io.ReadAll(literal); err == nil {
				s.ThreadID = extractThreadID(string(data))
			}
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

// GetMessageHeaders fetches the envelope (from, to, cc, subject, date, message-id, in-reply-to, references) without the full body.
// Note: References is not part of IMAP ENVELOPE; we fetch it via HEADER.FIELDS.
func GetMessageHeaders(conn *UserConnection, folder string, uid uint32) (*MessageHeaders, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, true); err != nil {
		return nil, fmt.Errorf("select folder %q: %w", folder, err)
	}

	seq := new(goimap.SeqSet)
	seq.AddNum(uid)

	section := headerFieldsSection("References")

	items := []goimap.FetchItem{
		goimap.FetchUid,
		goimap.FetchEnvelope,
		goimap.FetchFlags,
		section.FetchItem(),
	}

	ch := make(chan *goimap.Message, 1)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.UidFetch(seq, items, ch)
	}()

	var headers MessageHeaders
	for msg := range ch {
		headers.UID = msg.Uid
		if msg.Envelope != nil {
			if msg.Envelope.From != nil && len(msg.Envelope.From) > 0 {
				headers.From = formatAddress(msg.Envelope.From[0])
			}
			if msg.Envelope.To != nil && len(msg.Envelope.To) > 0 {
				headers.To = formatAddresses(msg.Envelope.To)
			}
			if msg.Envelope.Cc != nil && len(msg.Envelope.Cc) > 0 {
				headers.Cc = formatAddresses(msg.Envelope.Cc)
			}
			headers.Subject = msg.Envelope.Subject
			headers.Date = msg.Envelope.Date
			headers.MessageID = msg.Envelope.MessageId
			headers.InReplyTo = msg.Envelope.InReplyTo
		}
		if msg.Flags != nil {
			headers.Flags = ParseMessageFlags(msg.Flags)
		}
		// Parse References from the fetched header fields
		if literal := msg.GetBody(section); literal != nil {
			if data, err := io.ReadAll(literal); err == nil {
				headers.References = parseReferencesHeader(string(data))
			}
		}
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("fetch headers: %w", err)
	}

	return &headers, nil
}

// extractThreadID extracts a thread ID from raw References/In-Reply-To header data.
// It uses the first message-id found in References, falling back to In-Reply-To.
func extractThreadID(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	var references, inReplyTo string
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "references:") {
			references = strings.TrimSpace(line[len("references:"):])
		} else if strings.HasPrefix(lower, "in-reply-to:") {
			inReplyTo = strings.TrimSpace(line[len("in-reply-to:"):])
		}
	}
	// Use the first message-id in References as thread root
	if references != "" {
		fields := strings.Fields(references)
		if len(fields) > 0 {
			return strings.Trim(fields[0], "<>")
		}
	}
	// Fall back to In-Reply-To
	if inReplyTo != "" {
		return strings.Trim(strings.Fields(inReplyTo)[0], "<>")
	}
	return ""
}

// parseReferencesHeader extracts the References value from a raw "References: ..." header line.
func parseReferencesHeader(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	// The header line looks like: "References: <id1> <id2>\r\n"
	if idx := strings.Index(raw, ":"); idx >= 0 {
		raw = strings.TrimSpace(raw[idx+1:])
	}
	return strings.Join(strings.Fields(raw), " ")
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

// ListAttachments returns a list of attachments for a given message UID.
func ListAttachments(conn *UserConnection, folder string, uid uint32) ([]AttachmentInfo, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, true); err != nil {
		return nil, fmt.Errorf("select folder %q: %w", folder, err)
	}

	seq := new(goimap.SeqSet)
	seq.AddNum(uid)

	ch := make(chan *goimap.Message, 1)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.UidFetch(seq, []goimap.FetchItem{goimap.FetchBodyStructure}, ch)
	}()

	var attachments []AttachmentInfo
	for msg := range ch {
		if msg.BodyStructure != nil {
			attachments = collectAttachments(msg.BodyStructure, "")
		}
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("fetch body structure: %w", err)
	}

	return attachments, nil
}

func collectAttachments(bs *goimap.BodyStructure, prefix string) []AttachmentInfo {
	var result []AttachmentInfo

	if len(bs.Parts) > 0 {
		for i, part := range bs.Parts {
			partID := fmt.Sprintf("%s%d", prefix, i+1)
			result = append(result, collectAttachments(part, partID+".")...)
		}
	} else {
		isAttachment := false
		if strings.EqualFold(bs.Disposition, "attachment") {
			isAttachment = true
		}
		// Also treat non-text parts with a filename as attachments
		if !isAttachment && bs.Params["name"] != "" && !strings.HasPrefix(bs.MIMEType, "text") {
			isAttachment = true
		}

		if isAttachment {
			partID := strings.TrimSuffix(prefix, ".")
			if partID == "" {
				partID = "1"
			}
			filename := bs.Params["name"]
			if filename == "" {
				filename = bs.DispositionParams["filename"]
			}
			result = append(result, AttachmentInfo{
				PartID:      partID,
				Filename:    filename,
				ContentType: bs.MIMEType + "/" + bs.MIMESubType,
				Size:        bs.Size,
			})
		}
	}

	return result
}

// GetAttachment fetches the content of a specific attachment by part ID.
func GetAttachment(conn *UserConnection, folder string, uid uint32, partID string) ([]byte, string, string, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, true); err != nil {
		return nil, "", "", fmt.Errorf("select folder %q: %w", folder, err)
	}

	seq := new(goimap.SeqSet)
	seq.AddNum(uid)

	// Parse part ID into section
	section, err := goimap.ParseBodySectionName(goimap.FetchItem("BODY[" + partID + "]"))
	if err != nil {
		return nil, "", "", fmt.Errorf("parse section: %w", err)
	}

	ch := make(chan *goimap.Message, 1)
	done := make(chan error, 1)
	go func() {
		done <- conn.Client.UidFetch(seq, []goimap.FetchItem{section.FetchItem()}, ch)
	}()

	var body []byte
	var contentType string
	var filename string
	for msg := range ch {
		literal := msg.GetBody(section)
		if literal != nil {
			body, err = io.ReadAll(literal)
			if err != nil {
				return nil, "", "", fmt.Errorf("read body: %w", err)
			}
		}
		if msg.BodyStructure != nil {
			contentType = findPartContentType(msg.BodyStructure, partID)
			filename = findPartFilename(msg.BodyStructure, partID)
		}
	}

	if err := <-done; err != nil {
		return nil, "", "", fmt.Errorf("fetch attachment: %w", err)
	}

	return body, contentType, filename, nil
}

func findPartContentType(bs *goimap.BodyStructure, partID string) string {
	if bs.MIMEType != "" && len(bs.Parts) == 0 {
		return bs.MIMEType + "/" + bs.MIMESubType
	}
	for _, part := range bs.Parts {
		if ct := findPartContentType(part, partID); ct != "" {
			return ct
		}
	}
	return "application/octet-stream"
}

func findPartFilename(bs *goimap.BodyStructure, partID string) string {
	if bs.Params["name"] != "" {
		return bs.Params["name"]
	}
	if bs.DispositionParams["filename"] != "" {
		return bs.DispositionParams["filename"]
	}
	return ""
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

// GetThreadMessages searches the given folder for messages belonging to a thread.
// A message belongs to the thread if its References header contains the threadId
// OR its Message-ID matches the threadId. Results are sorted by date ascending.
func GetThreadMessages(conn *UserConnection, folder string, threadID string) ([]MessageSummary, error) {
	conn.mu.Lock()
	defer conn.mu.Unlock()

	if _, err := conn.Client.Select(folder, true); err != nil {
		return nil, fmt.Errorf("select folder %q: %w", folder, err)
	}

	// Search for messages that have the threadID in their References header
	criteria := goimap.NewSearchCriteria()
	criteria.Header.Set("References", threadID)

	refsUIDs, err := conn.Client.UidSearch(criteria)
	if err != nil {
		return nil, fmt.Errorf("search references: %w", err)
	}

	// Also search for the thread root message (whose Message-ID matches threadID)
	rootCriteria := goimap.NewSearchCriteria()
	rootCriteria.Header.Set("Message-ID", threadID)

	rootUIDs, err := conn.Client.UidSearch(rootCriteria)
	if err != nil {
		return nil, fmt.Errorf("search message-id: %w", err)
	}

	// Merge UIDs (deduplicate)
	uidSet := make(map[uint32]bool)
	for _, uid := range refsUIDs {
		uidSet[uid] = true
	}
	for _, uid := range rootUIDs {
		uidSet[uid] = true
	}

	if len(uidSet) == 0 {
		return []MessageSummary{}, nil
	}

	seq := new(goimap.SeqSet)
	for uid := range uidSet {
		seq.AddNum(uid)
	}

	threadSection := headerFieldsSection("References", "In-Reply-To")

	items := []goimap.FetchItem{
		goimap.FetchUid,
		goimap.FetchEnvelope,
		goimap.FetchFlags,
		goimap.FetchRFC822Size,
		goimap.FetchInternalDate,
		threadSection.FetchItem(),
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
		if literal := msg.GetBody(threadSection); literal != nil {
			if data, err := io.ReadAll(literal); err == nil {
				s.ThreadID = extractThreadID(string(data))
			}
		}
		summaries = append(summaries, s)
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("fetch thread messages: %w", err)
	}

	// Sort by date ascending (oldest first for conversation view)
	for i := 0; i < len(summaries)-1; i++ {
		for j := i + 1; j < len(summaries); j++ {
			if summaries[j].Date.Before(summaries[i].Date) {
				summaries[i], summaries[j] = summaries[j], summaries[i]
			}
		}
	}

	return summaries, nil
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

	// Fetch headers for threading (References, In-Reply-To)
	searchThreadSection := headerFieldsSection("References", "In-Reply-To")

	items := []goimap.FetchItem{
		goimap.FetchUid,
		goimap.FetchEnvelope,
		goimap.FetchFlags,
		goimap.FetchRFC822Size,
		goimap.FetchInternalDate,
		searchThreadSection.FetchItem(),
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
		// Extract thread_id from References or In-Reply-To headers
		if literal := msg.GetBody(searchThreadSection); literal != nil {
			if data, err := io.ReadAll(literal); err == nil {
				s.ThreadID = extractThreadID(string(data))
			}
		}
		summaries = append(summaries, s)
	}

	if err := <-done; err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}

	return summaries, nil
}
