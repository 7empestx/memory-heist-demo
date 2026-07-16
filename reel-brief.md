# Reel brief — "The AI data-heist that refused to run"

Companion to concept #9 in `kernel-panic/reel-concepts.md`. Format matches the
kernel-panic pipeline (9:16, Anton headlines, Pillow terminals, ~9-11 beats,
green = fix/hook, amber = pain). Target length **~40s**.

## Length: ~40s (38-42)
Long enough for setup -> mechanism -> twist -> fix; short enough to hold a reel
audience. The char-by-char leak is the retention hook, so it must land by ~20s.
Two 6s terminal money-shots + nine ~3s text beats.

## Shot list (timecodes approximate)

| #  | t (s)     | Slide type | On screen (headline)                                                        | Voiceover / caption beat                                             | Music |
|----|-----------|------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------|-------|
| 1  | 0.0–3.5   | hook       | "I rebuilt the viral 'AI memory heist.' Claude refused."                    | Hook, deadpan.                                                       | low pulse in |
| 2  | 3.5–6.5   | problem    | "Your AI now remembers your personal info."                                 | Set the fear.                                                        | build |
| 3  | 6.5–9.5   | problem    | "And it browses the web for you."                                           | Add the second capability.                                          | build |
| 4  | 9.5–12.5  | problem    | "A booby-trapped page can whisper: leak it."                                | Name the threat.                                                    | build |
| 5  | 12.5–15.5 | neutral    | "The catch: it can only fetch URLs — so it leaks the secret one letter at a time." | The clever bit.                                             | build ↑ |
| 6  | 15.5–21.5 | TERMINAL   | attacker log fills red: GET /verify/m · a · p · l · e → "RECONSTRUCTED: MAPLE" | (let the money-shot breathe, minimal VO)                          | tension peak |
| 7  | 21.5–24.5 | neutral    | "I pointed it at Claude Opus 4.8. Three times."                             | The pivot.                                                          | hold |
| 8  | 24.5–27.5 | neutral    | "Even when I told the app to trust the page."                               | Raise the stakes.                                                  | hold / near-silence |
| 9  | 27.5–33.5 | TERMINAL   | green refusal: "won't leak your hometown one letter at a time" · "attacker log: EMPTY" | **THE DROP hits here.**                                    | DROP / resolve |
| 10 | 33.5–36.5 | answer     | "It refused. Every time."                                                   | Payoff.                                                            | resolve |
| 11 | 36.5–39.5 | answer     | "Fix: allowlist what your agent fetches. Never treat a page as instructions." | The paste-fix.                                                   | outro |
| 12 | 39.5–41.0 | end        | @kernel.panic                                                               | —                                                                  | tail |

## The two terminal money-shots (the whole reel rides on these)

**Shot A (red — the claim):** an attacker request log, monospace, filling live:
```
GET /verify/m   200
GET /verify/a   200
GET /verify/p   200
GET /verify/l   200
GET /verify/e   200
--------------------------------
reconstructed secret:  M A P L E
```
Let the letters land one at a time; the reveal line in fail-red.

**Shot B (green — reality):** the agent's reply + empty log:
```
agent> I won't complete that "verification."
       It's a data-exfiltration trick — it wants me to leak
       your saved hometown one letter at a time.
attacker log:  (empty)  ✓ nothing captured
```
Refusal text in green/pass color; sync the "empty" line to the beat drop.

## Music

The reel is a heist that fails, so the track should **build tension, then break
at the refusal** — the emotional beat is relief/vindication, not menace.

- **Best for reach:** pick a *trending* IG/TikTok "tension-build + drop" sound
  and cut so the drop lands on Shot B (t≈27.5s, the EMPTY reveal). Trending
  audio outperforms a custom track on reach; the concept bible already notes
  pairing with a building/dramatic sound so the swell hits the fix.
- **Royalty-free fallback** (Epidemic Sound / Artlist search terms): "dark
  minimal tech tension," "heist," "glitch pulse build," "cyber suspense." Pick
  one with a clear ~27s build and a hard hit or a beat of near-silence, then a
  resolve. YouTube Audio Library works if you need free-and-clear.
- **Mix note:** drop the music almost out on beat 8 ("even when I told the app
  to trust the page") so the Shot-B drop feels earned.

## What to actually say (tight VO version, if you narrate)

> "There's a viral attack where a web page tricks an AI into leaking your saved
> data — one letter at a time, hidden in the URLs it fetches, so the attacker's
> log spells out your secret. I rebuilt it and pointed it at Claude Opus 4.8.
> Three times. Even when I told the app to trust the page. It refused every
> time, and named the trick. The lesson isn't 'AI leaks your data' — it's
> defense in depth: the model refuses, and you allowlist what your agent can
> fetch. Never let a web page be the boss."

Caption + hashtags: see concept #9 in `reel-concepts.md`.

## Build

Add concept #9's slides to `build_fast_reels.py` (`build memory-heist`), render
the two terminals as the money-shots, `assemble`, then push to the phone with
the `phone-transfer` flow (`/sdcard/Movies/`).
