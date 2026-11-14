# Cheat Sheet

Quick-reference commands for Git, the Unix/macOS shell, macOS keyboard shortcuts, Bun, ngrok, SendGrid, Claude Code, and this machine's `~/.zshrc`.

## Git

### Setup

- `git config --global user.name "Name"` — set your commit author name
- `git config --global user.email "email"` — set your commit author email
- `git init` — create a new repo in the current directory
- `git clone <url>` — copy a remote repo locally

### Everyday workflow

- `git status` — see what's changed, staged, or untracked
- `git add <file>` — stage a file (`git add .` stages everything)
- `git commit -m "message"` — commit staged changes
- `git commit -am "message"` — stage all tracked changes and commit in one step
- `git push` — push committed changes to the remote
- `git pull` — fetch and merge remote changes into the current branch

### Branching

- `git branch` — list local branches
- `git branch <name>` — create a new branch
- `git switch <name>` / `git checkout <name>` — switch to a branch
- `git switch -c <name>` / `git checkout -b <name>` — create and switch in one step
- `git branch -d <name>` — delete a branch (safe, only if merged)
- `git merge <name>` — merge a branch into the current one
- `git rebase <name>` — replay current branch's commits on top of another

### Inspecting history

- `git log` — commit history
- `git log --oneline --graph --all` — compact visual history across branches
- `git diff` — unstaged changes
- `git diff --staged` — staged changes not yet committed
- `git show <commit>` — details of a specific commit
- `git blame <file>` — who last changed each line

### Undoing things

- `git restore <file>` — discard unstaged changes to a file
- `git restore --staged <file>` — unstage a file (keep the edits)
- `git reset --soft HEAD~1` — undo the last commit, keep changes staged
- `git reset --hard HEAD~1` — undo the last commit and discard changes (destructive)
- `git revert <commit>` — create a new commit that undoes a prior one (safe for shared history)

### Stashing

- `git stash` — shelve uncommitted changes
- `git stash -u` — also stash untracked files
- `git stash list` — see stashed entries
- `git stash pop` — reapply and remove the latest stash
- `git stash drop` — delete a stash without applying it

### Remotes

- `git remote -v` — list remotes and their URLs
- `git remote add origin <url>` — add a remote named `origin`
- `git fetch` — download remote changes without merging
- `git push -u origin <branch>` — push a new branch and set it to track the remote

## Linux / Unix Shell

### Navigation & files

- `pwd` — print working directory
- `ls -la` — list all files (including hidden) with details
- `cd <dir>` / `cd -` — change directory / jump back to the previous one
- `cp <src> <dst>` / `cp -r` — copy a file / copy a directory recursively
- `mv <src> <dst>` — move or rename
- `rm <file>` / `rm -rf <dir>` — remove a file / forcibly remove a directory (destructive)
- `mkdir -p <path>` — create a directory, including parents as needed
- `touch <file>` — create an empty file or update its timestamp

### Searching

- `find <path> -name "<pattern>"` — find files by name
- `grep -r "<text>" <path>` — search file contents recursively
- `grep -rn "<text>" <path>` — same, with line numbers
- `which <cmd>` — show which executable a command resolves to

### Permissions

- `chmod +x <file>` — make a file executable
- `chmod 644 <file>` — set rw-r--r-- permissions
- `chown <user>:<group> <file>` — change file ownership

### Processes

- `ps aux` — list all running processes
- `top` / `htop` — live process monitor
- `kill <pid>` / `kill -9 <pid>` — terminate a process / force-terminate
- `lsof -i :<port>` — see what's using a port (servers *and* anything connected to it)
- `lsof -iTCP:<port> -sTCP:LISTEN` — only the server listening on a port; use this form with `kill $(lsof -t …)` so you don't also kill clients like ngrok
- `jobs`, `fg`, `bg` — manage background/foreground shell jobs

### Text processing

- `cat <file>` — print a file's contents
- `less <file>` — page through a file
- `head -n 20 <file>` / `tail -n 20 <file>` — first/last 20 lines
- `tail -f <file>` — follow a file as it grows (e.g. logs)
- `sort` / `uniq` — sort lines / collapse duplicates
- `wc -l` — count lines
- `sed 's/old/new/g'` — find-and-replace text in a stream
- `awk '{print $1}'` — extract a column of output

### System & disk

- `df -h` — disk space by volume
- `du -sh <dir>` — total size of a directory
- `uname -a` — system/kernel info
- `history` — recent shell command history

### Networking

- `curl -s <url>` — fetch a URL
- `ping <host>` — check connectivity
- `ssh <user>@<host>` — remote shell

### Archives

- `tar -czvf out.tar.gz <dir>` — create a gzipped tarball
- `tar -xzvf out.tar.gz` — extract one

### Homebrew (macOS)

- `brew install <pkg>` — install a package
- `brew update && brew upgrade` — update Homebrew and installed packages
- `brew list` — list installed packages

## macOS Keyboard Shortcuts

### Window & app management

- `Cmd+Tab` / `Cmd+Shift+Tab` — switch between open apps (forward/backward)
- ``Cmd+` `` — switch between windows of the current app
- `Cmd+Q` — quit the current app
- `Cmd+W` — close the current window/tab
- `Cmd+H` — hide the current app
- `Cmd+Option+Esc` — force-quit an unresponsive app
- `Cmd+Space` — open Spotlight search
- `Ctrl+Up` / `F3` — Mission Control
- `Ctrl+Left` / `Ctrl+Right` — switch between full-screen Spaces

### Text editing (system-wide)

- `Cmd+C` / `Cmd+V` / `Cmd+X` — copy / paste / cut
- `Cmd+Z` / `Cmd+Shift+Z` — undo / redo
- `Cmd+A` — select all
- `Cmd+F` — find
- `Cmd+Left` / `Cmd+Right` — jump to start/end of line
- `Option+Left` / `Option+Right` — jump by word
- `Cmd+Delete` — delete to start of line
- `Option+Delete` — delete previous word

### Screenshots

- `Cmd+Shift+3` — capture the full screen
- `Cmd+Shift+4` — capture a selected area
- `Cmd+Shift+5` — open the screenshot/recording toolbar

### Finder & misc

- `Cmd+N` — new Finder window
- `Cmd+Shift+N` — new folder
- `Cmd+Delete` — move selected item to Trash
- `Cmd+Shift+Delete` — empty Trash
- `Cmd+,` — open preferences for the current app
- `Ctrl+Cmd+Space` — emoji & symbol picker
- `Ctrl+Cmd+Q` — lock the screen

## Bun

### Installing dependencies

- `bun install` — install all dependencies from the lockfile/manifest
- `bun add <pkg>` — add a dependency
- `bun add -d <pkg>` — add a dev dependency
- `bun remove <pkg>` — remove a dependency
- `bun update` — update dependencies within semver ranges

### Running things

- `bun run <script>` — run a script from `package.json`
- `bunx <pkg>` — run a package's CLI without installing it globally
- `bun <file.ts>` — run a TS/JS file directly (Bun has a built-in runtime, no separate `ts-node` needed)
- `bun test` — run the project's test suite

### Inspecting & managing

- `bun pm ls` — list installed dependencies
- `bun outdated` — show dependencies with newer versions available
- `bun pm cache rm` — clear the package manager's cache

### Workspaces (monorepos)

- `bun install` — installs all workspaces defined in the root `package.json` in one pass
- `bun run --cwd <path> <script>` — run a script scoped to one workspace
- `bun run --filter <name> <script>` — run a script in workspace(s) matching a name/glob

## ngrok

Exposes the local frontend (`localhost:3000`) at a public HTTPS address so you can try the app from a phone or another computer. This machine's free ngrok domain is fixed: **https://gratify-polyester-talon.ngrok-free.dev**.

> **Other developers:** that address belongs to Sandy's ngrok account. Each developer who wants a tunnel needs their own free ngrok account (steps below), which comes with its own fixed domain — use that wherever this section shows `gratify-polyester-talon.ngrok-free.dev`, including in your own `.env` files. Sharing one free account isn't practical: it has a single domain that only one person can tunnel through at a time, and shared monthly quotas. Only needed for testing from another device — everyday work on `localhost:3000` doesn't use ngrok.

### Installing (one-time)

- Install Homebrew first if you don't have it — the install command is on [brew.sh](https://brew.sh)
- `brew install ngrok` — install the ngrok CLI
- Sign up at [ngrok.com](https://ngrok.com) (free), then copy your authtoken from the dashboard and run `ngrok config add-authtoken <token>` — links the CLI to your account, which is what gives you the fixed domain above
- `ngrok version` — confirm it's installed

### One-time setup (`.env` files)

- `frontend/.env`: `PUBLIC_API_URL=` (blank) — the app then calls the API through the frontend's own address instead of `localhost:4000`
- `frontend/.env`: `TUNNEL_HOST=gratify-polyester-talon.ngrok-free.dev` — no `https://`; lets the dev server accept requests for that hostname
- `backend/.env`: `TUNNEL_URL=https://gratify-polyester-talon.ngrok-free.dev` — lets you sign in through the tunnel
- Restart after changing any of them: `bun run dev:restart`

### Starting & stopping

- `bun run dev:restart --ngrok` — restart both dev servers and start the tunnel; prints the public URL
- `bun run dev:restart` — restart the servers only; leaves a running tunnel alone
- `bun run dev:stop` — stop both servers and the tunnel
- `pkill ngrok` — stop just ngrok (`pkill -9 ngrok` if it won't quit)
- `pgrep -fl ngrok` — check whether it's running (no output = stopped)
- `tail -f ngrok.log` — ngrok's log when started by the script

### Using it

- Use **https://gratify-polyester-talon.ngrok-free.dev** wherever you'd use `http://localhost:3000` (e.g. `…/login` instead of `localhost:3000/login`)
- Health check: open **https://gratify-polyester-talon.ngrok-free.dev/api/health** — expect `{"status":"ok","database":"connected"}`
- From the terminal: `curl -H "ngrok-skip-browser-warning: 1" https://gratify-polyester-talon.ngrok-free.dev/api/health`
- It's `https://`, not `http://` — ngrok serves the tunnel over HTTPS
- `http://localhost:3000` keeps working at the same time

### Gotchas

- First visit in a browser shows an ngrok warning page — click **Visit Site** (once per browser)
- "The endpoint … is offline" (`ERR_NGROK_3200`) — ngrok isn't running; start it with `bun run dev:restart --ngrok`
- "Can't reach server" on login — usually `PUBLIC_API_URL` isn't blank, or the frontend wasn't restarted after changing it; a hard refresh (`Cmd+Shift+R`) also clears the old cached app
- Links in notification emails still point at `FRONTEND_URL` (`http://localhost:3000`), so they only open on this Mac
- `kill $(lsof -t -i :3000)` also kills ngrok — use the `-sTCP:LISTEN` form (see Processes above) or `bun run dev:stop`

### How it was set up on this machine (Sandy, Oct 2026)

1. Installed Homebrew (7.0.11) using the install command from [brew.sh](https://brew.sh)
2. `brew install ngrok` — installs ngrok 3.39.13 to `/opt/homebrew/bin/ngrok` (Homebrew installs it as a cask)
3. Created a free account at [ngrok.com](https://ngrok.com), then `ngrok config add-authtoken <token>` — saved to `~/Library/Application Support/ngrok/ngrok.yml`; the account's domain is `gratify-polyester-talon.ngrok-free.dev`
4. Ran `ngrok http 3000` and opened the tunnel URL — the page loaded, but login failed with "can't reach server" because the app was still calling the API at `localhost:4000`
5. Made the app work through the tunnel (code changes, now shared in the repo): the frontend dev server forwards `/api` to the backend, a blank `PUBLIC_API_URL` means "use the page's own address", and the backend accepts sign-ins from `TUNNEL_URL`
6. Set the three `.env` values from "One-time setup" above and restarted both servers — login then worked through the tunnel
7. Added `scripts/dev-servers.sh` (`bun run dev:restart --ngrok` / `dev:stop`) so the tunnel starts and stops with the dev servers

## SendGrid (email notifications)

The app emails every submitted shift report and these announcements — new arrival, pending adoption, adopted, back available, returned to RCC, kennel move requested, kennel needs reset, and manual posts — all to one address, `NOTIFICATION_TO`. With the email settings blank, emails are printed to the backend log instead of sent, which is fine for most dev work. Nothing is ever sent under `bun test`.

> **Other developers:** the SendGrid account and `team@7cornerscats.com` sender below are Sandy's personal setup. To get real emails, create your own free SendGrid account and verified sender (steps below) — or leave the settings blank. Outside production, always point `NOTIFICATION_TO` at your own address, never the org's Google Group.

### Setting up (one-time)

- Sign up at [sendgrid.com](https://sendgrid.com)
- Settings → Sender Authentication → **Domain Authentication** — add the DNS records SendGrid gives you to the sending domain; best for landing in the inbox, but needs access to the domain's DNS
- Settings → Sender Authentication → **Single Sender Verification** — verify one from-address by clicking a link emailed to it; quickest option
- Settings → API Keys → Create API Key → **Restricted Access** with only **Mail Send** turned on — the key is shown once, so copy it straight into `backend/.env`

### `backend/.env`

- `SENDGRID_API_KEY=SG.…` — the API key
- `EMAIL_FROM=` — a verified sender address (or any address on an authenticated domain)
- `NOTIFICATION_TO=` — where every notification goes; your own address in dev
- All three must be set — if any is blank, the app quietly falls back to printing emails to the log
- Restart after changing them: `bun run dev:restart` (the mailer is set up once at startup)

### Testing & troubleshooting

- **Submit** a shift report (saving a draft doesn't email) — the email goes out within seconds
- `tail -f backend.log` — watch for `[mailer] (not sent — console mailer)` (settings not loaded) or `[notifications] failed to send` (SendGrid rejected it)
- A failed send is saved on the report/announcement (`emailLastError`, `emailAttempts`) and retried every 5 minutes, up to 5 attempts
- Turning email on sends **every** submitted report and announcement that was never emailed — on a database with lots of old test data, that can be a burst of emails
- Links inside the emails use `FRONTEND_URL` (`http://localhost:3000` in dev), so they only open on this Mac

### How it was set up on this machine (Sandy, Oct 2026)

1. Created a personal SendGrid account
2. Authenticated the `7cornerscats.com` domain (Domain Authentication) — all DNS records validate
3. Verified the single sender `team@7cornerscats.com`, display name "Cat Team"
4. Created an API key — currently a full-access key; better to replace it with a **Mail Send**–only key (create it, paste it into `backend/.env`, `bun run dev:restart`, then delete the old key in SendGrid)
5. Set `backend/.env`: the API key, `EMAIL_FROM=team@7cornerscats.com`, `NOTIFICATION_TO=sandy.chopra@gmail.com`
6. Restarted the backend and submitted a shift report — the email arrived in the Gmail inbox (not spam)

## Claude Code

### Starting a session

- `claude` — start an interactive session in the current directory
- `claude "prompt"` — start a session with an initial prompt
- `claude -p "prompt"` — run a one-shot prompt non-interactively and print the result
- `claude --continue` — resume the most recent session in this directory
- `claude --resume` — pick a previous session to resume from a list

### Slash commands (inside a session)

- `/help` — show help for using Claude Code
- `/clear` — clear the conversation and start fresh
- `/compact` — summarize/compact the conversation to free up context
- `/init` — generate a `CLAUDE.md` for the current repo
- `/resume` — resume a different previous session
- `/model` — switch the active model
- `/agents` — manage subagents
- `/permissions` — view/edit tool permission rules
- `/mcp` — manage connected MCP servers
- `/memory` — edit memory files
- `/cost` — show token usage for the session
- `/vim` — toggle vim-style key bindings
- `/doctor` — diagnose installation/config issues
- `/bug` — report a bug to Anthropic

### Handy shortcuts

- `! <command>` — run a shell command directly and show its output in the chat
- `Esc` — interrupt Claude mid-response
- `Esc` `Esc` — step back through earlier messages to edit/retry
- `Ctrl+C` — cancel the current input/generation
- `Ctrl+D` — exit Claude Code

## `~/.zshrc`

Reference copy of this machine's current shell config.

```zsh
export PATH="$HOME/.local/bin:$PATH"
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
export PATH="$HOME/bin:$PATH"

# bun completions
[ -s "/Users/Sandy/.bun/_bun" ] && source "/Users/Sandy/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# psql
export PATH="/Library/PostgreSQL/18/bin":$PATH

# Enable Zsh's built-in Version Control System info framework
autoload -Uz vcs_info
precmd_functions+=( vcs_info )

# Format the Git info output (cyan text, enclosed in brackets)
zstyle ':vcs_info:git:*' formats ' [%F{cyan}%b%f]'

# Allow variable substitution in the prompt
setopt PROMPT_SUBST

# Construct the prompt: [current-folder] [git-branch] %
PROMPT='%F{green}[%~]%f${vcs_info_msg_0_} %# '
```
