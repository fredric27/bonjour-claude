# bonjour-claude ☕

Manda in automatico un messaggino a Claude a un orario prestabilito, così la
[finestra di sessione di 5 ore di Claude Code](https://support.anthropic.com/) parte
da sola prima che tu ti sieda alla scrivania.

Zero dipendenze: serve solo Node.js ≥ 18 e [Claude Code](https://claude.com/claude-code)
installato (`claude`). Il messaggio viene inviato con `claude -p`, quindi usa il tuo
account Anthropic esattamente come una sessione normale.

## Installazione

```sh
git clone <repo> && cd bonjour-claude
npm install -g .
```

## Uso

```sh
# 1. Login (se su questa macchina usi già Claude Code, non serve nulla;
#    su un server genera un token long-lived con la procedura guidata)
bonjour-claude login

# 2. Scegli l'orario, con fuso orario IANA (default: fuso di sistema)
bonjour-claude set 08:00 --tz Europe/Rome

# 3. Avvia il daemon: ogni giorno alle 08:00 manda il messaggio
bonjour-claude start
```

Altri comandi:

```sh
bonjour-claude send      # invia subito (utile per testare il login)
bonjour-claude status    # config, prossimo invio, esito ultimo invio
bonjour-claude set 07:30 --message "Bonjour!"   # cambia orario/messaggio
```

## Su un server

Il daemon è un processo normale: tienilo vivo come preferisci.

Con **tmux**:

```sh
tmux new -d -s bonjour 'bonjour-claude start'
```

Con **systemd** (`~/.config/systemd/user/bonjour-claude.service`):

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
```

## Note

- La configurazione vive in `~/.config/bonjour-claude/` (file a permessi 600:
  possono contenere il token OAuth).
- I fusi orari sono gestiti correttamente anche attraverso i cambi ora
  legale/solare: l'orario impostato è sempre "ora locale del fuso scelto".
- Il daemon si risveglia almeno una volta l'ora e ricontrolla l'orologio, quindi
  sopravvive a sospensioni della macchina senza sfasarsi.
