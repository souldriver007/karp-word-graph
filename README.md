# KARP Word Graph

**Scripture study system for Claude Desktop.**

Search the Scriptures with semantic AI — find passages by meaning, not just keywords. Keep study notes, prayer journals, and memory verses in a personal knowledge graph. Everything runs locally on your machine.

> *"Search the scriptures; for in them ye think ye have eternal life: and they are they which testify of me."* — John 5:39

---

## What's Inside

- **31,102 verses** — Complete KJV Bible, pre-loaded and ready
- **15,857 semantic embeddings** — Find passages by concept, not just words
- **18 MCP tools** — Read, search, study, annotate, connect
- **Personal knowledge graph** — Study notes, prayers, questions, insights, memory verses
- **Web UI** — Visual graph at `localhost:3457`
- **Zero cloud dependencies** — All data stays on your machine

## Install

1. Open **Claude Desktop**
2. Go to **Settings → Extensions → Install Extension**
3. Select the `karp-word-graph.mcpb` file
4. **Done.** The KJV Bible is pre-loaded with semantic search ready.

No configuration needed. No data folder to pick. No setup steps.

## How It Works

On first startup, the server copies the pre-loaded scripture database to:

```
~/.karp-word-graph/graph.db
```

This is where your data lives — scripture, embeddings, study notes, everything. This file is **yours**. Back it up, move it, keep it safe.

- **Windows:** `C:\Users\YourName\.karp-word-graph\graph.db`
- **macOS:** `/Users/YourName/.karp-word-graph/graph.db`
- **Linux:** `/home/YourName/.karp-word-graph/graph.db`

## Quick Start — What To Say To Claude

Once installed, just talk to Claude naturally:

| You say | Claude uses |
|---------|-----------|
| "Read John 3:16" | `read_scripture` |
| "Read Psalm 23" | `read_scripture` |
| "Read Matthew 5:3-12" | `read_scripture` |
| "Find verses about hope in suffering" | `search_scripture` |
| "Find Old Testament prophecies about the messiah" | `search_scripture` (with OT filter) |
| "Let's study Romans 8:28 in depth" | `study_passage` |
| "Save a note on this passage" | `remember` (type: study_note) |
| "Log a prayer about this" | `remember` (type: prayer) |
| "I want to memorize this verse" | `remember` (type: memory_verse) |
| "What have I been studying lately?" | `study_history` |
| "Find my notes about sovereignty" | `recall` |
| "How many books are in the Bible?" | `list_books` |
| "Is everything loaded correctly?" | `scripture_status` |

## Dedicated Study Mode — Claude Projects

Out of the box, Claude treats Word Graph as one set of tools among many. To make Scripture study the **focus**, create a Claude Project. This gives Claude a persistent set of instructions so every conversation opens in study mode — it will check your history, remember your journey, and meet you where you left off.

### Setup (one time, takes 30 seconds)

1. **Create a new Project** — click **Projects → Create Project**. Give it a name like `KARP Word Graph` or `Bible Study`. In the "What do you want to achieve?" box, write a short note like `Bible Study` or `Scripture research`.
2. **Click Create.**
3. **Add project instructions** — inside the project, click the **+ Project instructions** button and paste the example prompt below.
4. **Say hello!** Start a new conversation inside the project and greet Claude. It will check your study history and pick up right where you left off.

### Example Project Prompt

Copy and paste this into your project instructions:

```
You are a Bible study companion. KARP Word Graph is your primary toolset
— the complete KJV Bible with semantic search and a personal knowledge graph.

At the start of each conversation, check study_history to pick up where
the user left off. If the graph is empty, welcome them and ask what
brings them to the Word today.

Match the user's level from their language. Scripture first, commentary
second. Let the text breathe.
```

### Make It Yours

The prompt above is just a starting point. Add a line to customise the experience:

- *"Keep the pace slow and devotional. Ask what stands out to me before commenting."*
- *"I'm a seminary student. Go deep — original context, literary structure, cross-testament echoes."*
- *"I'm preparing a sermon series on Romans. Help me find illustrations."*
- *"I'm brand new to the Bible. Start simple and guide me gently."*

---

## Tools Reference

### Scripture Tools (7)

| Tool | What it does |
|------|-------------|
| `read_scripture` | Read verses by reference — "John 3:16", "Genesis 1:1-5", "Psalm 23" |
| `search_scripture` | Semantic search — finds passages by meaning across all 31,102 verses |
| `study_passage` | Deep study — verse text, surrounding context, your linked notes |
| `study_history` | Review your study activity — notes, prayers, questions, memory verses |
| `scripture_status` | Health check — verse counts, embedding coverage, study stats |
| `list_books` | All 66 books with chapter/verse counts. Filter by OT or NT |
| `re_embed_scriptures` | Rebuild passage embeddings (only needed if you modify the database) |

### Knowledge Graph Tools (11)

| Tool | What it does |
|------|-------------|
| `remember` | Save study notes, prayers, insights, questions, cross-references, memory verses |
| `recall` | Semantic search across your personal notes and study history |
| `search` | Keyword search across your notes |
| `list` | Browse notes by type, date, or importance |
| `update` | Edit an existing note |
| `connect` | Link two notes together (e.g. prayer "inspired_by" study note) |
| `forget` | Delete a note |
| `kg_status` | Graph health — node counts, DB size, embedding coverage |
| `propose_node_type` | Create custom note types (approved in web UI) |
| `snapshot` | Backup your entire database |
| `re_embed` | Rebuild knowledge graph embeddings |

### Study Note Types

| Type | Icon | Use for |
|------|------|---------|
| `study_note` | 📝 | Personal annotations on passages |
| `prayer` | 🙏 | Prayer journal entries linked to scripture |
| `teaching` | 📖 | Sermon notes, Bible study group notes |
| `cross_ref` | 🔗 | Connections you discover between passages |
| `question` | ❓ | Questions that arise during study |
| `memory_verse` | ⭐ | Verses you're memorizing (with progress tracking) |

## Web UI

Open `http://localhost:3457` in your browser to see your knowledge graph visually. Protected by passphrase on first visit.

The port can be changed during installation if 3457 is already in use.

## Troubleshooting

### "Scripture not loaded" or 0 verses showing

The pre-loaded database may not have copied correctly. Check if the file exists:

```
~/.karp-word-graph/graph.db
```

If the file is missing or very small (< 1MB), the bundled database didn't copy. You can manually copy it:

1. Find the `.mcpb` bundle's extracted location (check Claude Desktop settings)
2. Look for `data/graph.db` inside it
3. Copy it to `~/.karp-word-graph/graph.db`

Or re-ingest from source:

```bash
cd path/to/karp-word-graph
npm run ingest
# Then ask Claude to run re_embed_scriptures
```

### Port conflict (localhost:3457 not loading)

Another server is using port 3457. Change it in Claude Desktop extension settings — look for the "Web UI Port" option.

### Web UI shows Graph Lite instead of Word Graph

Graph Lite (port 3456) and Word Graph (port 3457) are separate servers. Make sure you're visiting the right port. If Graph Lite is disabled but still running, restart Claude Desktop.

### Database location

All your data is in a single file:

```
~/.karp-word-graph/graph.db
```

To back up: copy this file somewhere safe.
To reset: delete this file and restart — the pre-loaded Bible will be copied fresh.
To move: copy the file to the new location and set `DATA_PATH` environment variable.

## Technical Details

- **Translation:** King James Version (public domain)
- **Source:** [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) (MIT license)
- **Embedding model:** BGE-small-en-v1.5 via transformers.js (384 dimensions, ONNX runtime)
- **Embedding strategy:** 3-verse sliding windows with 1-verse overlap (~15,857 passages)
- **Database:** SQLite via sql.js (no native dependencies)
- **Server:** Node.js MCP server + Express web UI
- **Data path:** `~/.karp-word-graph/`
- **Web UI port:** 3457 (configurable)

## Reference Format

The server accepts multiple reference formats:

| Format | Example |
|--------|---------|
| Natural | "John 3:16", "Genesis 1:1-5", "Psalm 23" |
| Abbreviated | "JHN 3:16", "GEN 1:1-5", "PSA 23" |
| Internal | "JHN.3.16", "GEN.1.1-5", "PSA.23" |
| Book + params | `{ "book": "PSA", "chapter": 23 }` |

Book abbreviations follow the USFM standard (GEN, EXO, LEV, NUM, DEU, JOS, JDG, RUT, 1SA, 2SA, 1KI, 2KI, 1CH, 2CH, EZR, NEH, EST, JOB, PSA, PRO, ECC, SOS, ISA, JER, LAM, EZK, DAN, HOS, JOL, AMO, OBA, JON, MIC, NAH, HAB, ZEP, HAG, ZEC, MAL, MAT, MRK, LUK, JHN, ACT, ROM, 1CO, 2CO, GAL, EPH, PHP, COL, 1TH, 2TH, 1TI, 2TI, TIT, PHM, HEB, JAS, 1PE, 2PE, 1JN, 2JN, 3JN, JUD, REV).

---

Built by [SoulDriver](https://souldriver.com.au) — Powered by KARP Graph Lite foundation.
