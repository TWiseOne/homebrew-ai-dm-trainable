# Play candidate — The Storehouse Lantern

A terminal session on this PC. Ollama narrates. The engine owns the numbers. You enter Aria's natural d20. The goblin's dice are rolled by the engine.

This does not train the model. Each completed turn is appended to `data/play-traces/<gameId>.jsonl` for later review.

## Run

Requires Node 22 and a running Ollama model.

```bash
npm install
cp .env.example .env
npm run play
```

Set `DM_MODEL` in `.env` to a model `ollama list` already shows. The default is `qwen3:8b`.

```bash
npm run play -- --continue
npm run play -- --game <gameId>
```

## How to play

- Talk to Warden Colm.
- Go to the storehouse door and force it. When the client asks, type a number from 1 to 20, or `/roll` to roll that die on the machine.
- Check the engine line: `d20 + modifier = total`.
- Fight the goblin. Your attack d20 is yours. The goblin's attack line is the engine's.
- Take the lantern and return to the yard.
- `/quit`, then `npm run play -- --continue`. Scene, HP, lantern, and the finished errand should match.

`/save` writes `data/ai-rpg-v06.sqlite`. `/inventory` lists what Aria carries.

Aria is level 1. Proficiency bonus is +2. Her Athletics check to force the door is a d20 plus Strength +3, against DC 12. Damage dice are rolled by the engine.

## What this candidate does not do

Spells, conditions, a published adventure, a website, voice, and model training are not in this build.
