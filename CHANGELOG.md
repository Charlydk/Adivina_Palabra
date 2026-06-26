# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-26

First stable release used for the academic demo (Tecnología Educativa I, UTN).

### Added
- **Game modes**: Solo, Versus Local, Online Coop and Online Versus, with
  real-time play over SignalR.
- **Versus Local secret word**: a player types a hidden word (masked input)
  for the other to guess, sanitized to the on-screen A-Z keyboard.
- **Play again**: finished online games restart with a new word for the same
  connected players — no new link needed. Restart reuses the original
  theme/category instead of a random word.
- **Nickname prompt**: a player joining via a shared link chooses their name
  before connecting.
- **Mode navigation**: "Elegir otro modo" returns to mode selection instead of
  the intro video; the ranking screen gets a "Volver a elegir juego" button.
- **Teacher portal**: word lists, AI list generation, join codes, classroom
  mode, real-time monitoring, CSV export and per-word game history.
- **UTN credits**: logo and author credit on the start screen, intro video and
  footer. Footer copyright year is computed dynamically. App version shown in
  the footer.

### Fixed
- **Teacher lists by account**: list ownership is keyed to the authenticated
  Google email (case-insensitive) instead of a mutable alias, so a teacher
  always sees their own lists after logging in.
- **Hangman image on replay**: the image remounts on word change so the phase
  sequence shows correctly after "Play again".
- Lower victory sound volume.

[1.0.0]: https://github.com/Charlydk/Adivina_Palabra/releases/tag/v1.0.0
