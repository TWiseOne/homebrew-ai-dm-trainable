# AI RPG V0.6 — Rocky Linux 9 implementation

## 1. Install prerequisites

```bash
sudo dnf update -y
sudo dnf install -y git curl tar gzip gcc-c++ make
```

Install Node.js 22. A simple per-user route is nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node --version
npm --version
```

## 2. Deploy V0.6

Copy/unzip the release, then:

```bash
cd ai-rpg-v0.6
npm install
npm test
npm run demo
```

`npm test` must end with `V0.6 golden foundation tests PASS` before proceeding.

SQLite is provided by Node 22's `node:sqlite`; no separate SQLite npm dependency is required. The default future save path is `data/ai-rpg-v06.sqlite`.

## 3. Install Ollama

Use Ollama's current Linux installer or your existing Ollama host. Verify:

```bash
ollama --version
ollama list
ollama ps
```

Pull a model appropriate to the machine, for example:

```bash
ollama pull qwen3:8b
```

Do not hard-code the Ollama host in source. Create `.env` from `.env.example`:

```bash
cp .env.example .env
vi .env
```

For Ollama on the same Rocky host:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_API_KEY=ollama
DM_MODEL=qwen3:8b
```

For Ollama on another LAN machine, replace `127.0.0.1` with that host's address and ensure Ollama is intentionally listening on the LAN interface and your firewall permits only the required trusted network.

Test the language layer:

```bash
npm run ollama:test
```

The response should recognize that sneaking past a guard requires an engine-mediated check rather than inventing a d20 result.

## 4. Rocky firewall/security

V0.6's current executable surface is CLI/testing; it does not need an inbound application port. If Ollama is local, keep it bound locally. If Ollama is remote, expose its port only on a trusted LAN and do not expose it directly to the public internet.

## 5. Recommended service layout later

When the V0.6 web runtime is reintroduced, run it as a dedicated unprivileged `airpg` user under systemd, keep secrets in an EnvironmentFile readable only by that user, put a reverse proxy/TLS/authentication in front before internet exposure, and keep Ollama/model services separate from the application process.

## 6. Development commands

```bash
npm run build       # TypeScript compile
npm test            # deterministic golden-foundation tests
npm run demo        # deterministic 5e foundation demo
npm run ollama:test # OpenAI-compatible Ollama smoke test
```

## 7. Current V0.6 boundary

This release is the clean-break golden foundation: Participant/Controller/Actor state, version-pinned Ruleset V2, initial SRD 5.2.1 checks/saves/initiative/martial attacks, deterministic events, constrained capability dispatcher, and SQLite persistence. It intentionally does not preserve V0.5 saves.

The next AI milestone is DM Agent V1 using the capability dispatcher with structured tool calls; do not train/fine-tune the model yet. First establish tool-use evaluations against Ollama.
