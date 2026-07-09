# bonjour-claude ☕

**Start your Claude Code 5-hour session window automatically, right on schedule.**

Claude subscription plans (Pro/Max) meter Claude Code usage in 5-hour session
windows: the window starts with your first message and ends 5 hours later. If
you sit down at your desk at 9:00 and send your first message then, your window
runs 9:00–14:00.

bonjour-claude sends a tiny, one-line message to Claude at a time you choose —
for example 8:00 — so the session window is already running before you start
your day, and you get the most out of each window. That's it. It's a small
daemon that says *"Bonjour Claude!"* on your behalf, once a day, in your
timezone.

No claude.ai reverse-engineering: the message is sent with `claude -p`, so it
uses your Anthropic account exactly like a normal Claude Code session. Zero
runtime dependencies.

## Requirements

- **Node.js ≥ 18** — <https://nodejs.org>
- **Claude Code** (the `claude` command) — `npm install -g @anthropic-ai/claude-code`
  or `curl -fsSL https://claude.ai/install.sh | bash`
- A **Claude subscription** (Pro/Max): the 5-hour window is your account's

## Installation

```sh
git clone <repo-url> bonjour-claude
cd bonjour-claude
npm install -g .
```

## Usage on your own machine

If you already use Claude Code on this machine you're already logged in, so two
commands are enough:

```sh
# 1. Pick the time, with an IANA timezone (default: system timezone)
bonjour-claude set 08:00 --tz Europe/Rome

# 2. Start the daemon: every day at 08:00 it sends the message
bonjour-claude start
```

Other commands:

```sh
bonjour-claude send      # send right now (handy to check everything works)
bonjour-claude status    # config, next send, last send result
bonjour-claude set 07:30 --message "Bonjour!"   # change time/message
bonjour-claude help
```

## Hosting on a server

On a headless server there's no browser login, so you need a long-lived token.
Full flow from a blank server:

```sh
# 1. Install Node and Claude Code (see Requirements)

# 2. Install bonjour-claude
git clone <repo-url> && cd bonjour-claude && npm install -g .

# 3. Login: the guided flow runs `claude setup-token`
#    (it gives you a URL to open on your own computer, you authorize with
#    your Anthropic account, paste the code back) and stores the token
bonjour-claude login

# 4. Check that sending works
bonjour-claude send

# 5. Set the time in YOUR timezone (the server can be on UTC, doesn't matter)
bonjour-claude set 08:00 --tz Europe/Rome
```

Then keep the daemon alive however you prefer.

With **tmux** (quickest):

```sh
tmux new -d -s bonjour 'bonjour-claude start'
tmux attach -t bonjour        # to see the logs
```

With **systemd** (restarts on reboot) — create
`~/.config/systemd/user/bonjour-claude.service`:

```ini
[Unit]
Description=bonjour-claude

[Service]
ExecStart=/usr/bin/env bonjour-claude start
Restart=on-failure

[Install]
WantedBy=default.target
```

```sh
systemctl --user enable --now bonjour-claude
journalctl --user -u bonjour-claude -f     # logs
loginctl enable-linger $USER               # keep it running without an open session
```

With **pm2**:

```sh
pm2 start bonjour-claude -- start && pm2 save
```

## Notes

- Configuration lives in `~/.config/bonjour-claude/` (files with 600
  permissions: they may contain your OAuth token). The location can be
  overridden with the `BONJOUR_CLAUDE_DIR` environment variable.
- Timezones are handled correctly across DST changes: the configured time is
  always "local wall-clock time of the chosen timezone".
- The daemon wakes up at least once an hour and re-checks the clock, so it
  survives machine suspends without drifting.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `cannot run "claude"` | Claude Code is not installed or not in the daemon's PATH (with systemd, check the service's PATH) |
| `claude exited with code 1 (are you logged in?)` | Run `claude` once by hand to log in, or `bonjour-claude login` to store a token |
| Message goes out at the wrong time | Check `bonjour-claude status`: the timezone shown there is the one that counts, not the server's |
