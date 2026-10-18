# Olivia One Drive

The `/drive` page provides private uploads, filename search, downloads, and permanent deletion. Files are stored as MIME attachments in each authenticated Mailcow mailbox's `Olivia Drive` folder. Nothing is sent through SMTP. The user's existing Dovecot storage limit therefore covers both emails and Drive files, including MIME encoding overhead. Concurrent mail deliveries and uploads remain subject to server quota enforcement.

The gateway reads the actual shared quota with IMAP GETQUOTAROOT (`getQuota('INBOX')`). If the server cannot return a finite storage limit, uploads remain disabled. No subscription values or mailbox passwords are sent to the browser. The authenticated session alone selects the mailbox; file IDs contain UIDVALIDITY and UID, scoped to the fixed Drive folder. Permanent deletion requires UIDPLUS, to avoid expunging unrelated messages.

Maximum upload size is 20 MiB per file (encoded request under 28 MiB). Reverse proxies must allow 28 MiB request bodies and 120-second uploads on `/api/drive`. Downloads are attachments with `application/octet-stream`, `nosniff`, and private no-store caching. The API uses the existing session, CSRF checks, and rate limits. Mock mailboxes report Drive unavailable rather than inventing plan quotas.

Files also appear in the `Olivia Drive` folder in other mail clients. Renaming, moving or deleting that folder or its messages outside Olivia affects Drive contents. Deletion is permanent and does not use Trash. File rows show the stored MIME size, matching quota accounting.

Validation: `npm run build`, `npm run gateway:build`, `npm --prefix olivia-gateway test`, and `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/drive.spec.js tests/logout.spec.js`.
