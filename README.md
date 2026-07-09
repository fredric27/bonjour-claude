# bonjour-claude ☕

Manda in automatico un messaggino a Claude a un orario prestabilito, così la
finestra di sessione di 5 ore di Claude Code parte da sola prima che tu ti
sieda alla scrivania.

Zero dipendenze: il messaggio viene inviato con `claude -p`, quindi usa il tuo
account Anthropic esattamente come una sessione normale.

## Prerequisiti

- **Node.js ≥ 18** — <https://nodejs.org>
- **Claude Code** (il comando `claude`) — `npm install -g @anthropic-ai/claude-code`
  oppure `curl -fsSL https://claude.ai/install.sh | bash`
- Un **abbonamento Claude** (Pro/Max): la finestra di 5 ore è quella del tuo account

## Installazione

```sh
git clone <url-del-repo> bonjour-claude
cd bonjour-claude
npm install -g .
```

## Uso sul tuo computer

Se su questa macchina usi già Claude Code sei già loggato, quindi bastano due comandi:

```sh
# 1. Scegli l'orario, con fuso orario IANA (default: fuso di sistema)
bonjour-claude set 08:00 --tz Europe/Rome

# 2. Avvia il daemon: ogni giorno alle 08:00 manda il messaggio
bonjour-claude start
```

Altri comandi:

```sh
bonjour-claude send      # invia subito (utile per verificare che tutto funzioni)
bonjour-claude status    # config, prossimo invio, esito ultimo invio
bonjour-claude set 07:30 --message "Bonjour!"   # cambia orario/messaggio
bonjour-claude help
```

## Hosting su un server

Su un server headless non c'è il login del browser, quindi serve un token
long-lived. Flusso completo da zero:

```sh
# 1. Installa Node e Claude Code (vedi Prerequisiti)

# 2. Installa bonjour-claude
git clone <url-del-repo> && cd bonjour-claude && npm install -g .

# 3. Login: la procedura guidata lancia `claude setup-token`
#    (ti dà un URL da aprire sul tuo computer, autorizzi con il tuo account
#    Anthropic, incolli il codice) e salva il token generato
bonjour-claude login

# 4. Verifica che l'invio funzioni
bonjour-claude send

# 5. Configura l'orario nel TUO fuso (il server può essere in UTC, non importa)
bonjour-claude set 08:00 --tz Europe/Rome
```

Poi tieni vivo il daemon come preferisci.

Con **tmux** (il più rapido):

```sh
tmux new -d -s bonjour 'bonjour-claude start'
tmux attach -t bonjour        # per vedere i log
```

Con **systemd** (riparte da solo al reboot) — crea
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
journalctl --user -u bonjour-claude -f     # log
loginctl enable-linger $USER               # resta attivo anche senza sessione aperta
```

Con **pm2**:

```sh
pm2 start bonjour-claude -- start && pm2 save
```

## Note

- La configurazione vive in `~/.config/bonjour-claude/` (file a permessi 600:
  possono contenere il token OAuth). La posizione è personalizzabile con la
  variabile d'ambiente `BONJOUR_CLAUDE_DIR`.
- I fusi orari sono gestiti correttamente anche attraverso i cambi ora
  legale/solare: l'orario impostato è sempre "ora locale del fuso scelto".
- Il daemon si risveglia almeno una volta l'ora e ricontrolla l'orologio, quindi
  sopravvive a sospensioni della macchina senza sfasarsi.

## Problemi comuni

| Sintomo | Soluzione |
| --- | --- |
| `impossibile eseguire "claude"` | Claude Code non è installato o non è nel PATH del daemon (con systemd controlla il PATH del servizio) |
| `claude è uscito con codice 1 (sei loggato?)` | Fai `claude` una volta a mano per loggarti, oppure `bonjour-claude login` per salvare un token |
| Il messaggio parte all'ora sbagliata | Controlla `bonjour-claude status`: il fuso mostrato è quello che conta, non quello del server |
