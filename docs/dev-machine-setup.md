# Dev Machine Setup (Mac)

What to install on a Mac to work on this app, from a fresh machine to a running dev server: command-line tools, Postgres, VS Code, Claude Code, and DataGrip. Accounts and services the app itself talks to (R2, SendGrid, ngrok, the domain) are in [`external-services.md`](external-services.md). Steps you repeat after every pull (dependencies, env vars, migrations) are in [`post-pull-checklist.md`](post-pull-checklist.md). Everyday commands are in [`cheat-sheet.md`](cheat-sheet.md).

| Tool | Used for | Required? |
|---|---|---|
| [Homebrew](#1-homebrew) | Installing the other command-line tools | Recommended |
| [Git & GitHub CLI](#2-git--github-cli) | Source control, pull requests | Yes |
| [Bun](#3-bun) | Runs the backend, installs packages, runs tests | Yes |
| [Postgres](#4-postgres) | The app's database | Yes (native or Docker) |
| [VS Code](#6-vs-code) | Editor, with shared settings in `.vscode/` | Recommended |
| [Claude Code](#7-claude-code) | AI coding assistant, in the terminal and in VS Code | Optional |
| [DataGrip](#8-datagrip-database-gui) | Browsing and querying tables by hand | Optional |

## 1. Homebrew

The usual Mac package manager. Install it from [brew.sh](https://brew.sh) (one `curl` command), then follow the "Next steps" it prints to add `brew` to your `PATH`. Check with `brew --version`.

## 2. Git & GitHub CLI

- Git comes with Apple's Command Line Tools. Running `git --version` offers to install them if they're missing (Homebrew's installer also installs them).
- Set your name and email once, so commits are attributed to you:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```
- GitHub CLI: `brew install gh`, then `gh auth login` (choose GitHub.com → HTTPS → log in with a web browser). It also sets up git's credentials, so `git push` works without a password prompt.
- Clone the repo (it's private, so you need access first):
  ```bash
  mkdir -p ~/workspace && cd ~/workspace
  gh repo clone sandychopra/lostdog
  ```

## 3. Bun

Runs the backend directly (no build step), installs packages for both workspaces, and runs the tests. Don't use npm, yarn, or pnpm in this repo.

```bash
curl -fsSL https://bun.sh/install | bash
```

Open a new terminal, then check with `bun --version`. Node.js isn't needed for the app.

## 4. Postgres

Each developer runs their own local database. A native install is recommended over Docker (see [`post-pull-checklist.md`](post-pull-checklist.md#4-database-sync) for why). `docker-compose.yml` uses Postgres 17, but any recent version works.

Pick one:

- **Installer** from [postgresql.org/download/macosx](https://www.postgresql.org/download/macosx/) (EDB). Installs to `/Library/PostgreSQL/<version>` and starts on login. Add its `bin` folder to your `PATH` in `~/.zshrc` so `psql` works:
  ```bash
  export PATH="/Library/PostgreSQL/<version>/bin:$PATH"
  ```
- **Homebrew:** `brew install postgresql@17`, then `brew services start postgresql@17`
- **Docker:** install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then `docker compose up -d postgres` from the repo root. No `PATH` change needed, but `psql` is only available inside the container.

Check with `psql --version`. Creating the app's role and database is step 4 of the post-pull checklist.

## 5. First run

Follow [`post-pull-checklist.md`](post-pull-checklist.md) from the top: `bun install`, the two `.env` files, the database role/migrations/seed, then `bun run dev:restart`. Open `http://localhost:3000` and sign in with the seed admin from `backend/.env`.

## 6. VS Code

1. Install from [code.visualstudio.com](https://code.visualstudio.com/) (or `brew install --cask visual-studio-code`). Drag it into Applications if you downloaded the zip.
2. Add the `code` command, so `code .` opens a folder: Command Palette (`Cmd+Shift+P`) → **Shell Command: Install 'code' command in PATH**.
3. Open the repo **root** (`code ~/workspace/lostdog`), not `backend/` or `frontend/` alone. The shared settings, ESLint config, and Prettier config all live at the root.
4. VS Code offers to install the recommended extensions. Click **Install** (or run **Extensions: Show Recommended Extensions**).
5. Open any `.ts` file, then Command Palette → **TypeScript: Select TypeScript Version** → **Use Workspace Version**. The repo pins TypeScript `~6.0`, and VS Code's built-in one may differ.

### What's in `.vscode/` (committed)

`extensions.json`, the recommended extensions:

| Extension | Why |
|---|---|
| Prettier (`esbenp.prettier-vscode`) | Formats on save using the repo's `.prettierrc.json`, the same as `bun run format` |
| ESLint (`dbaeumer.vscode-eslint`) | Shows lint errors inline, from the root `eslint.config.mjs` |
| Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`) | Class name autocomplete and color previews, including the brand tokens in `index.css` |
| Prisma (`prisma.prisma`) | Syntax highlighting, autocomplete, and formatting for `schema.prisma` |
| Claude Code (`anthropic.claude-code`) | See [Claude Code in VS Code](#claude-code-in-vs-code) |

`settings.json`, which applies to this repo only:

- **Format on save** with Prettier. Files listed in `.prettierignore` (Markdown, generated Prisma client) are left alone.
- **ESLint fixes on save** for problems ESLint can fix automatically. The rest still show as squiggles.
- `schema.prisma` is formatted by the Prisma extension, the same as `bunx prisma format`
- `typescript.tsdk` points at the repo's TypeScript (step 5 above)
- CSS files open as Tailwind CSS, so `@theme` and `@custom-variant` in `index.css` don't show "unknown at rule" warnings
- Tailwind autocomplete works inside `cn(...)` and `cva(...)` calls

Personal preferences (theme, font size, where panels open) go in your user settings, not in `.vscode/settings.json`.

## 7. Claude Code

Anthropic's AI coding assistant. It reads the repo, runs commands, and edits files when you ask. Needs a Claude Pro/Max subscription or an Anthropic Console account.

### Installing (one-time)

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Open a new terminal and check with `claude --version`. It updates itself in the background. Then `cd` into the repo root and run `claude`. The first run asks you to log in in the browser and to trust the folder.

### What it picks up from the repo

- **`CLAUDE.md`** (committed): project rules and architecture notes, read at the start of every session. Keep it up to date when a convention changes.
- **Skills** (`.claude/skills/`, committed): extra instructions Claude loads by itself when a task matches the skill's description. Run `/skills` in a session to list them.
  - **`better-auth-best-practices`:** Better Auth setup, sessions, plugins, and env vars. Installed from [`better-auth/skills`](https://github.com/better-auth/skills) with the `skills` CLI, which put it in `.agents/skills/better-auth-best-practices/` and recorded it in `skills-lock.json`. `.claude/skills/better-auth-best-practices` is a committed symlink to that folder.
  - **`frontend-design`:** guidance on visual design (palette, type, layout, UI copy) when building or reworking UI. Copied unchanged from [`anthropics/skills`](https://github.com/anthropics/skills/tree/main/skills/frontend-design) at commit `e4bb5d9` straight into `.claude/skills/frontend-design/` (no symlink or lock entry). To update it, copy that folder again from the newer commit. It pushes for bold, original looks, so tell Claude to stick with the brand tokens in `frontend/src/index.css` and the shadcn/ui components (see `CLAUDE.md`).
- **The `security-reviewer` agent** (`.claude/agents/security-reviewer.md`): a read-only security review of the codebase or a branch. Ask Claude to "run the security reviewer" before merging a feature that touches routes, auth, uploads, email, or env handling.
- The rest of `.claude/` (local settings, lock files) stays gitignored. Only `agents/` and `skills/` are committed.

Session commands and shortcuts: [`cheat-sheet.md`](cheat-sheet.md#claude-code).

### Claude Code in VS Code

- Install the **Claude Code** extension (it's in the recommended list), or search for "Claude Code" in the Extensions view (`Cmd+Shift+X`)
- Open it from the Spark icon in the editor toolbar, or Command Palette → **Claude Code: Open in New Tab**. Sign in the first time.
- It uses the same settings and MCP servers as the terminal `claude` command. It can also see the file and selection you have open, and VS Code's errors.
- You can also run `claude` in VS Code's built-in terminal (`` Ctrl+` ``) instead

### MCP servers

MCP servers give Claude extra tools. Check what's connected with `claude mcp list`, or `/mcp` inside a session.

**Context7** (library docs). `CLAUDE.md` asks Claude to look up current docs for Bun, Prisma, Express, React, and the rest through Context7, instead of relying on what it remembers.

1. Sign up at [context7.com](https://context7.com) and create an API key in the dashboard. The free tier is enough.
2. Add it at **user** scope, so it works in every project and the key stays in your home folder (`~/.claude.json`):
   ```bash
   claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp \
     --header "Authorization: Bearer <your-context7-key>"
   ```
3. Never add it at project scope (`.mcp.json`), since that file is committed and would publish your key

**Claude in Chrome** (browser testing). Lets Claude open the app in Chrome, click through it, and read the console and network requests. That's how the photo and R2 flows were checked.

1. Install the **Claude** extension from the Chrome Web Store and sign in with the same Claude account
2. In a Claude Code session, run `/chrome` to connect it
3. Claude works in its own tabs, but with your Chrome sign-ins. Keep it on `localhost` for this app.

## 8. DataGrip (database GUI)

JetBrains' desktop database IDE, for browsing tables, running ad-hoc SQL, and checking what the app actually wrote (e.g. a photo's `thumbnail_key`, the email outbox columns, `pending_storage_delete`). It's optional: everything it does can also be done with `psql` or `bunx prisma studio`.

> **Other developers:** DataGrip needs a JetBrains license. It's free for non-commercial use, students, and open-source work; otherwise it's paid. Any Postgres client works the same way here: `psql`, [Prisma Studio](https://www.prisma.io/studio) (`cd backend && bunx prisma studio`), TablePlus, DBeaver (free), or the Database tool built into IntelliJ IDEA Ultimate/WebStorm.

### Setting up (one-time)

- Install from [jetbrains.com/datagrip](https://www.jetbrains.com/datagrip/) (or the JetBrains Toolbox app)
- **New → Data Source → PostgreSQL**, then fill in the fields from `DATABASE_URL` in `backend/.env` (`postgresql://<user>:<password>@<host>:<port>/<database>`):
  - Host `localhost`, port `5432`
  - User, password, and database from the URL. With the `docker-compose.yml` defaults: `lostdog_app` / `changeme` / `lostdog`.
- Click **Download missing driver files** if prompted, then **Test Connection**
- In the data source's **Schemas** tab, tick only `public` so the tree isn't cluttered with system schemas

### Using it

- Tables and columns are `snake_case` (e.g. `shift_report`, `cat_entry`, `photo_cat_tag`), matching the `@map`s in `schema.prisma`, not the Prisma model names
- Check `backend/prisma/ERD.md` for how tables relate before writing joins
- Treat it as **read-only** for app data:
  - Edit through the app or the API so side effects run: activity log, announcements, email outbox, storage deletes
  - A row deleted by hand skips all of that (e.g. deleting a `photo` row leaves its files in storage until `bun run storage:reconcile`)
- Schema changes go through Prisma migrations (`bunx prisma migrate dev`), never DataGrip's table editor. A hand-made change makes the next migration fail with drift.
- Production (once deployed): connect with a read-only database user if possible, and use DataGrip's per-data-source **Read-only** setting

## How it was set up on this machine (Sandy, Nov 2026)

| Tool | Version | Installed via |
|---|---|---|
| Homebrew | 7.0 | brew.sh installer |
| Git | 2.54 (Apple Git) | Apple Command Line Tools |
| GitHub CLI | 2.100 | Downloaded binary in `~/bin` |
| Bun | 1.4.2 | `bun.sh/install` script (`~/.bun`) |
| Postgres | 18.6 | EDB installer (`/Library/PostgreSQL/18`) |
| Docker | — | Not installed (native Postgres instead) |
| VS Code | 1.142 | Download (`/Applications`) |
| Claude Code | 2.1 | Native installer (`~/.local/share/claude`) |
| DataGrip | — | Download (`/Applications/DataGrip.app`) |

- Postgres 18 works fine, even though `docker-compose.yml` and the checklist mention 17
- VS Code had only the Claude Code and Prisma extensions before `.vscode/extensions.json` was added. Install the other recommended ones when VS Code prompts.
- The Claude Code panel opens in VS Code's bottom panel (`"claudeCode.preferredLocation": "panel"` in user settings)
- Context7 is added at user scope with the API key in an `Authorization: Bearer` header, plus a global rule in `~/.claude/rules/context7.md` telling Claude to use it for library questions. Claude in Chrome is installed and connected.
- DataGrip: record the data source details here if they differ from the steps above
