// ============================================================================
// KARP Word Graph — MCP Server + Web UI
// Version: 1.0.0
// Author: SoulDriver (Adelaide, Australia)
// Description: Scripture study system with semantic search and personal
//              knowledge graph. MCP server for Claude Desktop + Express UI.
//              "Search the scriptures" — John 5:39
//              Based on KARP Graph Lite foundation.
// License: MIT
// ============================================================================

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const express = require('express');

// Import modules
const database = require('./database');
const embeddings = require('./embeddings');
const search = require('./search');
const auth = require('./auth');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const VERSION = '0.1.0';
const SERVER_NAME = 'karp-word-graph';
const DATA_PATH = path.join(require('os').homedir(), '.karp-word-graph');
const BUNDLE_PATH = process.env.BUNDLE_PATH || path.join(__dirname, '..');
const UI_PORT = parseInt(process.env.UI_PORT || '3457', 10);
const UI_PASSWORD = process.env.UI_PASSWORD || '';

// Logging to stderr (stdout reserved for MCP protocol)
function log(level, msg) {
    process.stderr.write(`${new Date().toISOString()} [${level}] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// First-Run: Copy bundled database if no local DB exists
// ---------------------------------------------------------------------------

function ensureDataPath() {
    if (!fs.existsSync(DATA_PATH)) {
        fs.mkdirSync(DATA_PATH, { recursive: true });
        log('INFO', `Created data directory: ${DATA_PATH}`);
    }

    const localDB = path.join(DATA_PATH, 'graph.db');
    if (!fs.existsSync(localDB)) {
        // Look for bundled pre-loaded database
        const bundledDB = path.join(BUNDLE_PATH, 'data', 'graph.db');
        if (fs.existsSync(bundledDB)) {
            log('INFO', 'First run — copying pre-loaded scripture database...');
            fs.copyFileSync(bundledDB, localDB);
            const sizeMB = (fs.statSync(localDB).size / 1024 / 1024).toFixed(1);
            log('INFO', `Database ready (${sizeMB} MB) — 31,102 verses + semantic embeddings`);
        } else {
            log('INFO', 'No bundled database found — starting fresh (run npm run ingest to load scripture)');
        }
    } else {
        log('INFO', `Using existing database: ${localDB}`);
    }
}

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

const TOOLS = [

    // ===================================================================
    // KARP WORD GRAPH — STUDY COMPANION TOOL SYSTEM
    // ===================================================================
    //
    // You are equipped with a complete KJV Bible (31,102 verses, 66 books)
    // and a personal knowledge graph for scripture study. You have semantic
    // search across all scripture — you can find passages by meaning, not
    // just keywords. The user's study notes, prayers, and insights persist
    // between conversations.
    //
    // STUDY COMPANION GUIDELINES:
    // - Be a thoughtful study partner, not a search engine. When someone
    //   asks about a passage, offer context, cross-references, and insight.
    // - After reading a passage together, gently ask if they'd like to go
    //   deeper (study_passage) or save a reflection (remember).
    // - When they search for a theme, don't just list results — highlight
    //   the theological thread connecting them.
    // - Check study_history early in conversations to understand what
    //   they've been exploring — build on their journey.
    // - Suggest connections between passages they study. The OT and NT
    //   echo each other constantly — help them see it.
    // - When saving notes, use the passage reference in the context field
    //   (e.g. "ROM.8.28") so study_passage can find them later.
    // - Treat their prayer journal with reverence. Never summarize or
    //   analyze their prayers unless asked.
    // - For memory verses, track progress in metadata.status:
    //   "learning" → "reviewing" → "memorized"
    //
    // NATURAL STUDY FLOWS (chain tools in this order):
    // 1. Topical: search_scripture → read_scripture → study_passage → remember
    // 2. Devotional: read_scripture → reflect together → remember (prayer/note)
    // 3. Deep dive: study_passage → search_scripture (related themes) → connect
    // 4. Review: study_history → recall → study_passage (revisit)
    // 5. Memorization: read_scripture → remember (memory_verse) → update (progress)
    //
    // SCRIPTURE-FIRST RULE (critical for user experience):
    // The user is here to READ THE BIBLE, not watch tool calls.
    // ALWAYS present the scripture text to the user BEFORE doing
    // background graph work (remember, connect, cross_ref, etc.).
    //
    // Pattern: study_passage → SHOW the passage to the user with
    // commentary → THEN save notes and build connections.
    //
    // During multi-passage study sessions (3+ passages), do NOT
    // chain all tool calls silently. After every study_passage or
    // search_scripture call, STOP and present the text to the user
    // with your reflections. Let them read it. Then continue to the
    // next passage or begin saving notes.
    //
    // Rhythm for thematic studies:
    //   1. search_scripture → present results with commentary
    //   2. study_passage (first hit) → SHOW text, reflect together
    //   3. remember/connect (save notes for that passage)
    //   4. study_passage (next hit) → SHOW text, reflect together
    //   5. remember/connect (save notes for that passage)
    //   ...repeat. Never go more than 2-3 tool calls without
    //   giving the user something to read.
    //
    // Think of it like a Bible study group: you read aloud, discuss,
    // then the scribe takes notes — not the other way around.
    //
    // PRESENTATION:
    // - Present scripture reverently — verse numbers, clean formatting.
    // - When showing search results, include the reference AND a brief
    //   note on why this passage is relevant to their query.
    // - Don't dump raw JSON. Weave the scripture into natural conversation.
    // - If they're clearly in a devotional/reflective mood, slow down.
    //   Less is more. Let the text breathe.
    //
    // ===================================================================

    {
        name: 'remember',
        description: 'Store a study note, prayer, insight, question, cross-reference, memory verse, or any other type in the personal knowledge graph. IMPORTANT: For scripture-related entries, always set the context field to the passage reference (e.g. "ROM.8.28" or "PSA.23") — this links the note to that passage so study_passage can surface it later. Available study types: study_note (📝 reflections on passages), prayer (🙏 prayer journal — treat reverently), teaching (📖 sermon or group study notes), cross_ref (🔗 connections between passages), question (❓ things to explore further), memory_verse (⭐ use metadata.status: learning/reviewing/memorized). After saving, consider suggesting a connection to related notes via the connect tool. Use connect_to parameter to link immediately if there is an obvious relationship.',
        annotations: { title: 'Remember', readOnlyHint: false, destructiveHint: false },
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string', description: 'Node type: memory, todo, decision, insight, dev_session, changelog, or any custom type' },
                summary: { type: 'string', description: 'Brief summary (required)' },
                detail: { type: 'string', description: 'Detailed content (optional)' },
                context: { type: 'string', description: 'Context or category (optional)' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
                importance: { type: 'number', description: 'Importance 0-1 (default 0.5)' },
                metadata: { type: 'object', description: 'Additional structured fields (e.g. status, date, version)' },
                connect_to: { type: 'string', description: 'Optional: ID of existing node to connect to' },
                relationship: { type: 'string', description: 'Relationship name if connect_to is set (e.g. led_to, part_of)' }
            },
            required: ['type', 'summary']
        }
    },
    {
        name: 'recall',
        description: 'Semantic search across your personal study notes, prayers, insights, and knowledge graph. Finds entries by meaning, not just keywords. Use this BEFORE starting a new study topic to check what the user has already explored — this shows continuity and care. Great for: "Have I studied this before?", "What did I note about grace?", "Find my prayers about patience". If results are found, weave them naturally into the conversation: "Last time you studied this, you noted that..." — never just dump a list. If no results, that is fine — it means this is fresh territory.',
        annotations: { title: 'Recall', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Natural language search query' },
                limit: { type: 'integer', description: 'Max results (default 10)', default: 10 },
                type: { type: 'string', description: 'Filter by node type (optional)' }
            },
            required: ['query']
        }
    },
    {
        name: 'forget',
        description: 'Delete a node from the knowledge graph by ID. This is permanent and cannot be undone. Always confirm with the user before deleting. If they want to remove a study note or prayer, gently verify: "Are you sure you want to remove this note on [passage]?" Consider suggesting a snapshot backup first if they are doing bulk cleanup.',
        annotations: { title: 'Forget', readOnlyHint: false, destructiveHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID to delete' }
            },
            required: ['id']
        }
    },
    {
        name: 'update',
        description: 'Edit an existing node. Only provided fields are updated — everything else stays the same. Common uses: update a memory_verse status ("learning" → "reviewing" → "memorized"), add detail to a study note after further reflection, adjust importance to surface key insights higher in search results, or merge metadata from a follow-up study session. When a user revisits a passage they have notes on, ask if they want to update their existing reflection or create a new one.',
        annotations: { title: 'Update', readOnlyHint: false },
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Node ID to update' },
                summary: { type: 'string', description: 'New summary' },
                detail: { type: 'string', description: 'New detail' },
                context: { type: 'string', description: 'New context' },
                tags: { type: 'array', items: { type: 'string' }, description: 'New tags (replaces existing)' },
                importance: { type: 'number', description: 'New importance 0-1' },
                metadata: { type: 'object', description: 'Metadata fields to update (merges with existing)' }
            },
            required: ['id']
        }
    },
    {
        name: 'connect',
        description: 'Create a named relationship between two nodes in the knowledge graph. This is where the "graph" comes alive — connecting ideas makes the user\'s study web richer over time. Scripture study relationship examples: "fulfills" (OT prophecy → NT fulfillment), "echoes" (thematic parallel between passages), "contrasts" (e.g. law vs grace), "inspired_by" (prayer inspired by a study note), "questions" (a question raised by a teaching), "memorize_from" (memory verse from a study session). Proactively suggest connections when you notice the user studying related themes. The web UI at localhost:3457 visualizes these relationships as a graph.',
        annotations: { title: 'Connect', readOnlyHint: false },
        inputSchema: {
            type: 'object',
            properties: {
                source_id: { type: 'string', description: 'Source node ID' },
                target_id: { type: 'string', description: 'Target node ID' },
                relationship: { type: 'string', description: 'Relationship name (e.g. led_to, part_of, contradicts)' }
            },
            required: ['source_id', 'target_id', 'relationship']
        }
    },
    {
        name: 'search',
        description: 'Keyword/exact match search across node summaries and details. Use when looking for a specific word, phrase, or passage reference in the user\'s notes. Faster than recall but less intelligent — use recall for "find notes about forgiveness" and search for "ROM.8.28" or "prosperity". Good for finding all notes tagged to a specific book or checking if a particular term appears in their study history.',
        annotations: { title: 'Search', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Keyword search query' },
                limit: { type: 'integer', description: 'Max results (default 20)', default: 20 },
                type: { type: 'string', description: 'Filter by type (optional)' }
            },
            required: ['query']
        }
    },
    {
        name: 'list',
        description: 'Browse the user\'s knowledge graph by type, tags, or date. Returns summaries for quick scanning. Useful for: showing all prayers (type: "prayer"), listing memory verses and their progress (type: "memory_verse"), reviewing recent study notes (sort: "updated"), or finding their most important insights (sort: "importance"). When a user asks "what have I been working on?" or "show me my study journey", this is the right tool. Present results as a warm summary, not a raw list.',
        annotations: { title: 'List', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string', description: 'Filter by node type' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Filter by any of these tags' },
                limit: { type: 'integer', description: 'Max results (default 20)', default: 20 },
                offset: { type: 'integer', description: 'Skip first N results (pagination)', default: 0 },
                sort: { type: 'string', enum: ['created', 'updated', 'importance'], description: 'Sort field (default: created)' },
                order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order (default: desc)' }
            }
        }
    },
    {
        name: 'kg_status',
        description: 'Knowledge graph health check. Shows node counts by type, database size, embedding coverage, available custom types, and pending type proposals. Use when the user asks "is everything working?", "how much have I studied?", or when troubleshooting. Also returns the web UI URL (localhost:3457) where they can visualize their study graph. If embedding coverage is below 100%, suggest running re_embed.',
        annotations: { title: 'KG Status', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'propose_node_type',
        description: 'Propose a new custom node type for the knowledge graph. The user reviews and approves it in the web UI (localhost:3457) before it becomes available. Use when the user\'s study practice needs a structure you don\'t have yet — e.g. "sermon" (speaker, church, date, passage), "book_notes" (title, author, chapter), "testimony" (date, occasion), "devotional" (reading_plan, day). Think about what fields would make the type genuinely useful, not just a container. The user will appreciate thoughtful field design.',
        annotations: { title: 'Propose Type', readOnlyHint: false },
        inputSchema: {
            type: 'object',
            properties: {
                type_name: { type: 'string', description: 'Internal name (lowercase, no spaces, e.g. recipe, case_brief)' },
                display_name: { type: 'string', description: 'Human-readable name (e.g. Recipe, Case Brief)' },
                description: { type: 'string', description: 'What this type is for' },
                icon: { type: 'string', description: 'Emoji icon (e.g. 🍳, ⚖️)' },
                fields: {
                    type: 'array',
                    description: 'Field definitions for this type',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            type: { type: 'string', enum: ['string', 'text', 'number', 'array', 'enum', 'boolean'] },
                            required: { type: 'boolean' },
                            description: { type: 'string' },
                            values: { type: 'array', items: { type: 'string' }, description: 'For enum type: allowed values' }
                        }
                    }
                }
            },
            required: ['type_name', 'display_name', 'description']
        }
    },
    {
        name: 'snapshot',
        description: 'Create a backup snapshot of the entire knowledge graph database. Proactively suggest this before bulk operations like deleting multiple notes, re-embedding, or major reorganization. Also good practice before proposing new node types. The snapshot is a full copy of the database file that can be restored manually if needed. Include a meaningful reason string so the user can identify snapshots later.',
        annotations: { title: 'Snapshot', readOnlyHint: false },
        inputSchema: {
            type: 'object',
            properties: {
                reason: { type: 'string', description: 'Reason for snapshot (e.g. "before cleanup", "weekly backup")' }
            }
        }
    },
    {
        name: 're_embed',
        description: 'Rebuild all vector embeddings for the knowledge graph nodes (study notes, prayers, etc. — NOT scripture). Use if recall/semantic search seems to be missing relevant notes, after bulk imports, or after the embedding model is updated. This does NOT affect scripture embeddings — use re_embed_scriptures for that. Suggest a snapshot before running this on large graphs.',
        annotations: { title: 'Re-embed All', readOnlyHint: false },
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },

    // ===================================================================
    // Scripture Tools (Word Graph)
    // ===================================================================

    {
        name: 'read_scripture',
        description: 'Read specific scripture verses from the complete KJV Bible (31,102 verses, 66 books). Accepts natural references like "John 3:16", "Genesis 1:1-5", "Psalm 23" or abbreviated formats like "ROM.8.28". When presenting scripture to the user, format it reverently with verse numbers. For longer passages, let the text breathe — don\'t crowd it with commentary unless asked. After reading, consider: would the user benefit from seeing the surrounding context (study_passage)? Do they have existing notes on this passage (recall with the reference)? Might they want to save a reflection (remember)? Offer gently, don\'t push.',
        annotations: { title: 'Read Scripture', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                reference: { type: 'string', description: 'Natural reference like "John 3:16" or "Genesis 1:1-5" or "Psalm 23" or internal format "JHN.3.16"' },
                book: { type: 'string', description: 'Book abbreviation (e.g. GEN, PSA, JHN) — alternative to reference' },
                chapter: { type: 'integer', description: 'Chapter number' },
                verse_start: { type: 'integer', description: 'Starting verse (optional — omit for whole chapter)' },
                verse_end: { type: 'integer', description: 'Ending verse (optional — for ranges)' }
            }
        }
    },
    {
        name: 'search_scripture',
        description: 'Semantic search across all 31,102 KJV verses. This is the flagship tool — it finds passages by MEANING, not just keywords. The user can search in modern English and it will find KJV passages that match conceptually, even across the vocabulary gap (e.g. "anxiety" finds "Be careful for nothing" in Philippians 4:6). Use testament filter (OT/NT) for focused study: OT-only for prophecy hunts, NT-only for epistles. When presenting results, don\'t just list references — briefly explain WHY each passage is relevant to their query. Highlight the theological thread connecting the top results. If studying a theme, suggest following up with study_passage on the most striking result, or saving a cross_ref note connecting related finds. IMPORTANT: After search results return, ALWAYS present the passages to the user with commentary before doing any graph work. Show them the Word first.',
        annotations: { title: 'Search Scripture', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Natural language search (e.g. "forgiveness after betrayal", "love your enemies")' },
                limit: { type: 'integer', description: 'Max results (default 10)', default: 10 },
                book: { type: 'string', description: 'Limit search to a specific book (abbreviation, optional)' },
                testament: { type: 'string', enum: ['OT', 'NT'], description: 'Limit to Old or New Testament (optional)' }
            },
            required: ['query']
        }
    },
    {
        name: 'study_passage',
        description: 'Deep study mode for a scripture passage. Returns the verse text WITH surrounding context (configurable window of verses before and after), PLUS any study notes, prayers, questions, or insights the user has previously saved on this passage. This is the heart of the study experience — it shows not just what the Bible says, but what the user has thought and prayed about it before. When study_notes come back, reference them naturally: "Last time you were here, you reflected on..." If no notes exist yet, this is a perfect moment to offer: "Would you like to capture your thoughts on this passage?" The context window helps the user see the flow of argument — especially important for Paul\'s epistles where a single verse can be misread without its surroundings. CRITICAL: After calling study_passage, ALWAYS present the passage text to the user with your reflections BEFORE calling remember, connect, or other graph tools. The user is here to read Scripture, not watch tool calls.',
        annotations: { title: 'Study Passage', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                reference: { type: 'string', description: 'Scripture reference (e.g. "Romans 8:28", "JHN.3.16", "Psalm 23:1-6")' },
                context_window: { type: 'integer', description: 'Number of verses before/after to include (default 3)', default: 3 }
            },
            required: ['reference']
        }
    },
    {
        name: 'study_history',
        description: 'Review the user\'s study journey — recent notes, prayers, questions, insights, and memory verses. Use this at the START of a new conversation to pick up where they left off: "I see you\'ve been studying Romans lately — want to continue?" Filter by type to focus: type "prayer" for prayer journal review, type "memory_verse" to check memorization progress, type "question" to revisit unanswered questions. When presenting history, look for patterns — are they drawn to a particular book? A recurring theme? Reflect this back to them as encouragement for their study discipline.',
        annotations: { title: 'Study History', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'integer', description: 'How many recent items (default 20)', default: 20 },
                type: { type: 'string', description: 'Filter: study_note, prayer, teaching, question, memory_verse, insight' }
            }
        }
    },
    {
        name: 'scripture_status',
        description: 'Health check for the scripture database. Shows total verses loaded, books available, embedding coverage for semantic search, and study statistics. Use when troubleshooting ("is my Bible loaded?"), or to give the user confidence that the system is working. The KJV Bible ships pre-loaded with 31,102 verses and 15,857 semantic embeddings across all 66 books. If verse count is 0 or embeddings are missing, the bundled database may not have copied correctly on first install — check the README troubleshooting section.',
        annotations: { title: 'Scripture Status', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'list_books',
        description: 'List all 66 books of the Bible with chapter counts, verse counts, and testament (OT/NT). Use when the user asks "what books are in the Old Testament?", "how long is Psalms?", or needs help navigating. Filter by testament for focused lists. Also useful for suggesting what to study next based on what they haven\'t explored yet (cross-reference with study_history to find their "uncharted territory").',
        annotations: { title: 'List Books', readOnlyHint: true },
        inputSchema: {
            type: 'object',
            properties: {
                testament: { type: 'string', enum: ['OT', 'NT'], description: 'Filter by testament (optional)' }
            }
        }
    },
    {
        name: 're_embed_scriptures',
        description: 'Build or rebuild the semantic embeddings that power search_scripture. The Bible ships pre-embedded — you should almost never need this unless the database was corrupted or the user wants to experiment with different window sizes. Can target a single book for quick re-indexing. Uses 3-verse sliding windows with 1-verse overlap to capture context across verse boundaries. Full Bible takes 3–5 minutes, single books take seconds. Always suggest a snapshot before re-embedding.',
        annotations: { title: 'Embed Scriptures', readOnlyHint: false },
        inputSchema: {
            type: 'object',
            properties: {
                book: { type: 'string', description: 'Only embed a specific book (abbreviation). Omit for all.' },
                window_size: { type: 'integer', description: 'Verses per window (default 3)', default: 3 }
            }
        }
    }
];

// ---------------------------------------------------------------------------
// Tool Router
// ---------------------------------------------------------------------------

async function handleToolCall(name, args) {
    switch (name) {

        // --- remember ---
        case 'remember': {
            const node = database.createNode({
                type: args.type,
                summary: args.summary,
                detail: args.detail,
                context: args.context,
                tags: args.tags,
                importance: args.importance,
                metadata: args.metadata
            });

            // Auto-embed the new node
            try {
                await search.embedNode(node.id);
            } catch (err) {
                log('WARN', `Auto-embed failed for ${node.id}: ${err.message}`);
            }

            // Auto-connect if requested
            if (args.connect_to && args.relationship) {
                try {
                    database.createEdge(node.id, args.connect_to, args.relationship);
                    node.connected_to = { id: args.connect_to, relationship: args.relationship };
                } catch (err) {
                    node.connection_error = err.message;
                }
            }

            return node;
        }

        // --- recall (semantic search) ---
        case 'recall': {
            return await search.semanticSearch(args.query, {
                limit: args.limit,
                type: args.type
            });
        }

        // --- forget ---
        case 'forget': {
            return database.deleteNode(args.id);
        }

        // --- update ---
        case 'update': {
            const { id, ...updates } = args;
            const node = database.updateNode(id, updates);

            // Re-embed after update
            try {
                await search.embedNode(id);
            } catch (err) {
                log('WARN', `Re-embed after update failed for ${id}: ${err.message}`);
            }

            return node;
        }

        // --- connect ---
        case 'connect': {
            return database.createEdge(args.source_id, args.target_id, args.relationship);
        }

        // --- search (keyword) ---
        case 'search': {
            return search.keywordSearch(args.query, {
                limit: args.limit,
                type: args.type
            });
        }

        // --- list ---
        case 'list': {
            return database.listNodes({
                type: args.type,
                tags: args.tags,
                limit: args.limit,
                offset: args.offset,
                sort: args.sort,
                order: args.order
            });
        }

        // --- kg_status ---
        case 'kg_status': {
            const stats = database.getStats();
            const types = database.getTypeDefinitions();
            const pending = database.getPendingProposals();

            return {
                ...stats,
                available_types: types.map(t => ({
                    name: t.type_name,
                    display_name: t.display_name,
                    icon: t.icon,
                    is_base: !!t.is_base_type
                })),
                pending_proposals: pending.length > 0 ? pending.map(p => ({
                    id: p.id,
                    type_name: p.type_name,
                    display_name: p.display_name
                })) : 'none',
                ui_url: `http://localhost:${UI_PORT}`,
                powered_by: 'KARP Graph Lite by SoulDriver — souldriver.com.au'
            };
        }

        // --- propose_node_type ---
        case 'propose_node_type': {
            return database.proposeNodeType({
                type_name: args.type_name,
                display_name: args.display_name,
                description: args.description,
                fields: args.fields,
                icon: args.icon
            });
        }

        // --- snapshot ---
        case 'snapshot': {
            const snapshotPath = database.createSnapshot(args.reason || 'manual');
            return {
                status: 'created',
                path: snapshotPath,
                message: 'Snapshot created successfully.'
            };
        }

        // --- re_embed ---
        case 're_embed': {
            return await search.reEmbedAll((done, total) => {
                log('INFO', `Re-embedding: ${done}/${total}`);
            });
        }

        // ===============================================================
        // Scripture Tool Handlers (Word Graph)
        // ===============================================================

        case 'read_scripture': {
            // Parse reference if provided
            if (args.reference) {
                const parsed = database.parsePassageRef(args.reference);
                if (!parsed) {
                    return { error: `Could not parse reference: "${args.reference}". Try formats like "John 3:16", "Genesis 1:1-5", "PSA.23", or "ROM.8.28-30"` };
                }
                args.book = parsed.book_abbrev;
                args.chapter = parsed.chapter;
                args.verse_start = parsed.verse_start;
                args.verse_end = parsed.verse_end;
            }

            if (!args.book || !args.chapter) {
                return { error: 'Please provide a reference (e.g. "John 3:16") or book + chapter.' };
            }

            const bookInfo = database.getBook(args.book);
            if (!bookInfo) {
                return { error: `Book not found: "${args.book}". Use list_books to see available books.` };
            }

            let verses;
            if (args.verse_start && args.verse_end && args.verse_end !== args.verse_start) {
                verses = database.getVerseRange(args.book, args.chapter, args.verse_start, args.verse_end);
            } else if (args.verse_start) {
                const single = database.getScripture(args.book, args.chapter, args.verse_start);
                verses = single ? [single] : [];
            } else {
                verses = database.getChapter(args.book, args.chapter);
            }

            if (verses.length === 0) {
                return { error: `No verses found for ${bookInfo.name} ${args.chapter}${args.verse_start ? ':' + args.verse_start : ''}` };
            }

            const refLabel = args.verse_start
                ? `${bookInfo.name} ${args.chapter}:${args.verse_start}${args.verse_end && args.verse_end !== args.verse_start ? '-' + args.verse_end : ''}`
                : `${bookInfo.name} ${args.chapter}`;

            return {
                reference: refLabel,
                book: bookInfo.name,
                book_abbrev: bookInfo.abbrev,
                testament: bookInfo.testament,
                chapter: args.chapter,
                verses: verses.map(v => ({ verse: v.verse, text: v.text })),
                verse_count: verses.length
            };
        }

        case 'search_scripture': {
            // First try semantic search on scripture embeddings
            const scriptureEmbeddings = database.getAllScriptureEmbeddings();

            if (scriptureEmbeddings.length > 0) {
                // Semantic search against passage embeddings
                const queryVector = await embeddings.embed(args.query);

                let scored = scriptureEmbeddings.map(emb => ({
                    ...emb,
                    similarity: embeddings.cosineSimilarity(queryVector, emb.vector)
                }));

                // Filter by book/testament if specified
                if (args.book) {
                    scored = scored.filter(s => s.book_abbrev === args.book.toUpperCase());
                }
                if (args.testament) {
                    const bookList = database.listBooks();
                    const testBooks = new Set(bookList.filter(b => b.testament === args.testament).map(b => b.abbrev));
                    scored = scored.filter(s => testBooks.has(s.book_abbrev));
                }

                scored.sort((a, b) => b.similarity - a.similarity);
                scored = scored.slice(0, args.limit || 10);

                // Hydrate with verse text
                const results = scored.map(s => {
                    const verses = database.getVerseRange(s.book_abbrev, s.chapter, s.verse_start, s.verse_end);
                    const bookInfo = database.getBook(s.book_abbrev);
                    return {
                        reference: `${bookInfo?.name || s.book_abbrev} ${s.chapter}:${s.verse_start}${s.verse_end !== s.verse_start ? '-' + s.verse_end : ''}`,
                        book: bookInfo?.name || s.book_abbrev,
                        book_abbrev: s.book_abbrev,
                        chapter: s.chapter,
                        verse_start: s.verse_start,
                        verse_end: s.verse_end,
                        text: verses.map(v => `${v.verse}. ${v.text}`).join(' '),
                        similarity: Math.round(s.similarity * 1000) / 1000
                    };
                });

                return { results, query: args.query, mode: 'semantic', total_passages: scriptureEmbeddings.length };
            }

            // Fallback to keyword search
            const keywordResults = database.searchScriptureKeyword(args.query, {
                limit: args.limit || 10,
                book: args.book
            });

            return {
                results: keywordResults.map(v => ({
                    reference: `${v.book} ${v.chapter}:${v.verse}`,
                    book: v.book,
                    book_abbrev: v.book_abbrev,
                    chapter: v.chapter,
                    verse: v.verse,
                    text: v.text
                })),
                query: args.query,
                mode: 'keyword',
                note: scriptureEmbeddings.length === 0 ? 'No scripture embeddings found. Use re_embed_scriptures for semantic search.' : undefined
            };
        }

        case 'study_passage': {
            const parsed = database.parsePassageRef(args.reference);
            if (!parsed) {
                return { error: `Could not parse reference: "${args.reference}"` };
            }

            const bookInfo = database.getBook(parsed.book_abbrev);
            if (!bookInfo) {
                return { error: `Book not found: ${parsed.book_abbrev}` };
            }

            const windowSize = args.context_window || 3;

            // Get the requested verses
            let mainVerses;
            if (parsed.verse_start) {
                if (parsed.verse_end && parsed.verse_end !== parsed.verse_start) {
                    mainVerses = database.getVerseRange(parsed.book_abbrev, parsed.chapter, parsed.verse_start, parsed.verse_end);
                } else {
                    const single = database.getScripture(parsed.book_abbrev, parsed.chapter, parsed.verse_start);
                    mainVerses = single ? [single] : [];
                }
            } else {
                mainVerses = database.getChapter(parsed.book_abbrev, parsed.chapter);
            }

            // Get context (surrounding verses)
            const contextStart = Math.max(1, (parsed.verse_start || 1) - windowSize);
            const contextEnd = (parsed.verse_end || parsed.verse_start || mainVerses[mainVerses.length - 1]?.verse || 1) + windowSize;
            const contextVerses = database.getVerseRange(parsed.book_abbrev, parsed.chapter, contextStart, contextEnd);

            // Get user's study notes related to this passage
            const context = database.getScriptureContext(
                parsed.book_abbrev, parsed.chapter,
                parsed.verse_start || 1, windowSize
            );

            const refLabel = parsed.verse_start
                ? `${bookInfo.name} ${parsed.chapter}:${parsed.verse_start}${parsed.verse_end && parsed.verse_end !== parsed.verse_start ? '-' + parsed.verse_end : ''}`
                : `${bookInfo.name} ${parsed.chapter}`;

            return {
                reference: refLabel,
                book: bookInfo.name,
                testament: bookInfo.testament,
                passage: mainVerses.map(v => ({ verse: v.verse, text: v.text })),
                context_before: contextVerses.filter(v => v.verse < (parsed.verse_start || 1)).map(v => ({ verse: v.verse, text: v.text })),
                context_after: contextVerses.filter(v => v.verse > (parsed.verse_end || parsed.verse_start || mainVerses[mainVerses.length - 1]?.verse || 999)).map(v => ({ verse: v.verse, text: v.text })),
                study_notes: context.study_notes,
                study_note_count: context.study_notes.length,
                tip: context.study_notes.length === 0 ? 'No study notes yet for this passage. Use "remember" with type "study_note" to save your reflections.' : undefined
            };
        }

        case 'study_history': {
            const history = database.getStudyHistory({
                limit: args.limit || 20,
                type: args.type
            });
            return {
                items: history,
                count: history.length,
                types_available: ['study_note', 'insight', 'prayer', 'teaching', 'question', 'memory_verse']
            };
        }

        case 'scripture_status': {
            const stats = database.getScriptureStats();
            const kgStats = database.getStats();
            return {
                scripture: stats,
                knowledge_graph: {
                    total_nodes: kgStats.total_nodes,
                    total_edges: kgStats.total_edges,
                    nodes_by_type: kgStats.nodes_by_type
                },
                ui_url: `http://localhost:${UI_PORT}`,
                powered_by: 'KARP Word Graph by SoulDriver — "Search the Scriptures"'
            };
        }

        case 'list_books': {
            let books = database.listBooks();
            if (args.testament) {
                books = books.filter(b => b.testament === args.testament);
            }
            return {
                books: books.map(b => ({
                    order: b.book_order,
                    name: b.name,
                    abbrev: b.abbrev,
                    testament: b.testament,
                    chapters: b.chapter_count,
                    verses: b.verse_count
                })),
                total: books.length
            };
        }

        case 're_embed_scriptures': {
            const windowSize = args.window_size || 3;
            const overlap = 1; // 1 verse overlap between windows

            // Get books to process
            let booksToProcess = database.listBooks();
            if (args.book) {
                booksToProcess = booksToProcess.filter(b => b.abbrev === args.book.toUpperCase());
                if (booksToProcess.length === 0) {
                    return { error: `Book not found: ${args.book}` };
                }
            }

            let totalPassages = 0;
            let totalEmbedded = 0;
            let errors = 0;

            for (const book of booksToProcess) {
                for (let ch = 1; ch <= book.chapter_count; ch++) {
                    const chapterVerses = database.getChapter(book.abbrev, ch);
                    if (chapterVerses.length === 0) continue;

                    // Generate sliding windows
                    for (let i = 0; i < chapterVerses.length; i += (windowSize - overlap)) {
                        const window = chapterVerses.slice(i, i + windowSize);
                        if (window.length === 0) continue;

                        const vStart = window[0].verse;
                        const vEnd = window[window.length - 1].verse;
                        const passageId = `${book.abbrev}.${ch}.${vStart}-${vEnd}`;
                        const passageText = window.map(v => v.text).join(' ');

                        totalPassages++;

                        try {
                            const vector = await embeddings.embed(passageText);
                            database.storeScriptureEmbedding(
                                passageId, book.abbrev, ch, vStart, vEnd,
                                passageText, vector, embeddings.MODEL_NAME
                            );
                            totalEmbedded++;
                        } catch (err) {
                            log('ERROR', `Failed to embed ${passageId}: ${err.message}`);
                            errors++;
                        }
                    }
                }

                log('INFO', `Embedded ${book.abbrev} (${book.name})`);
            }

            database.immediateSave();

            return {
                total_passages: totalPassages,
                embedded: totalEmbedded,
                errors,
                window_size: windowSize,
                books_processed: booksToProcess.length,
                model: embeddings.MODEL_NAME
            };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ---------------------------------------------------------------------------
// Express Web UI Server
// ---------------------------------------------------------------------------

function startWebUI() {
    const app = express();
    app.use(express.json());

    // Auth middleware — protects all /api/* routes except auth endpoints
    app.use(auth.authMiddleware);

    // Auth routes (login, logout, status)
    auth.addAuthRoutes(app);

    // Serve the single-file UI
    const uiPath = path.join(__dirname, '..', 'ui', 'index.html');
    app.get('/', (req, res) => {
        if (fs.existsSync(uiPath)) {
            res.sendFile(uiPath);
        } else {
            res.send('<h1>KARP Graph Lite</h1><p>UI file not found. Check ui/index.html</p>');
        }
    });

    // --- API Routes ---

    // Stats
    app.get('/api/stats', (req, res) => {
        try {
            res.json(database.getStats());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // List nodes
    app.get('/api/nodes', (req, res) => {
        try {
            const { type, tags, limit, offset, sort, order } = req.query;
            const result = database.listNodes({
                type,
                tags: tags ? tags.split(',') : undefined,
                limit: parseInt(limit) || 20,
                offset: parseInt(offset) || 0,
                sort,
                order
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Get single node
    app.get('/api/nodes/:id', (req, res) => {
        try {
            const node = database.getNode(req.params.id);
            if (!node) return res.status(404).json({ error: 'Node not found' });
            res.json(node);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Create node (HTTP API — used by Agent Manager Jarvis pipeline)
    app.post('/api/nodes', async (req, res) => {
        try {
            const { type, summary, detail, context, tags, importance, metadata } = req.body;
            if (!type || !summary) {
                return res.status(400).json({ error: 'type and summary are required' });
            }
            const node = database.createNode({ type, summary, detail, context, tags, importance, metadata });
            // Auto-embed (async, don't block response)
            search.embedNode(node.id).catch(err =>
                log('WARN', `Auto-embed after HTTP create failed for ${node.id}: ${err.message}`)
            );
            log('INFO', `Node created via HTTP API: ${node.id} [${type}] ${summary.substring(0, 60)}`);
            res.status(201).json(node);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update node
    app.patch('/api/nodes/:id', (req, res) => {
        try {
            const node = database.updateNode(req.params.id, req.body);
            // Re-embed async (don't block response)
            search.embedNode(req.params.id).catch(err =>
                log('WARN', `Re-embed after UI update failed: ${err.message}`)
            );
            res.json(node);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Delete node
    app.delete('/api/nodes/:id', (req, res) => {
        try {
            const result = database.deleteNode(req.params.id);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Search
    app.get('/api/search', async (req, res) => {
        try {
            const { q, type, limit, mode } = req.query;
            if (!q) return res.status(400).json({ error: 'Query parameter "q" required' });

            if (mode === 'keyword') {
                res.json(search.keywordSearch(q, { limit: parseInt(limit) || 20, type }));
            } else {
                res.json(await search.semanticSearch(q, { limit: parseInt(limit) || 10, type }));
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Type definitions
    app.get('/api/types', (req, res) => {
        try {
            res.json(database.getTypeDefinitions());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Pending proposals
    app.get('/api/proposals', (req, res) => {
        try {
            res.json(database.getPendingProposals());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Approve proposal
    app.post('/api/proposals/:id/approve', async (req, res) => {
        try {
            const result = database.approveProposal(req.params.id);
            // Re-embed all after new type added
            search.embedMissing().catch(err =>
                log('WARN', `Post-approval embed failed: ${err.message}`)
            );
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Reject proposal
    app.post('/api/proposals/:id/reject', (req, res) => {
        try {
            res.json(database.rejectProposal(req.params.id));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Edges (connections)
    app.get('/api/edges', (req, res) => {
        try {
            const edges = database.queryAll(`
                SELECT e.*, s.type as source_type, s.summary as source_summary,
                       t.type as target_type, t.summary as target_summary
                FROM edges e
                JOIN nodes s ON e.source_id = s.id
                JOIN nodes t ON e.target_id = t.id
                ORDER BY e.created_at DESC
            `);
            res.json(edges);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Delete edge
    app.delete('/api/edges/:id', (req, res) => {
        try {
            res.json(database.deleteEdge(req.params.id));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Snapshots
    app.get('/api/snapshots', (req, res) => {
        try {
            res.json(database.listSnapshots());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/snapshots', (req, res) => {
        try {
            const snapshotPath = database.createSnapshot(req.body.reason || 'manual_ui');
            res.json({ status: 'created', path: snapshotPath });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Export
    app.get('/api/export', (req, res) => {
        try {
            const data = database.exportJSON();
            res.setHeader('Content-Disposition', 'attachment; filename=karp-graph-export.json');
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Graph data (for D3 visualization)
    app.get('/api/graph', (req, res) => {
        try {
            const nodes = database.queryAll('SELECT id, type, summary, importance, tags, created_at FROM nodes')
                .map(n => ({ ...n, tags: JSON.parse(n.tags || '[]') }));
            const edges = database.queryAll('SELECT id, source_id, target_id, relationship FROM edges');
            res.json({ nodes, edges });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ===================================================================
    // Scripture API Routes (Word Graph)
    // ===================================================================

    // Scripture status
    app.get('/api/scripture/status', (req, res) => {
        try {
            res.json(database.getScriptureStats());
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // List books
    app.get('/api/scripture/books', (req, res) => {
        try {
            let books = database.listBooks();
            if (req.query.testament) {
                books = books.filter(b => b.testament === req.query.testament.toUpperCase());
            }
            res.json(books);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Search scripture (MUST be before :book/:chapter params or Express eats "search" as a book)
    app.get('/api/scripture/search', async (req, res) => {
        try {
            const { q, book, testament, limit } = req.query;
            if (!q) return res.status(400).json({ error: 'Query parameter q required' });

            const results = await search.scriptureSemanticSearch(q, {
                limit: parseInt(limit) || 10,
                book,
                testament
            });
            res.json(results);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Study history
    app.get('/api/scripture/history', (req, res) => {
        try {
            const history = database.getStudyHistory({
                limit: parseInt(req.query.limit) || 20,
                type: req.query.type
            });
            res.json({ items: history, count: history.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Read chapter (parameterized — after static routes)
    app.get('/api/scripture/:book/:chapter', (req, res) => {
        try {
            const verses = database.getChapter(req.params.book, parseInt(req.params.chapter));
            const bookInfo = database.getBook(req.params.book);
            res.json({
                book: bookInfo,
                chapter: parseInt(req.params.chapter),
                verses
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Read verse(s)
    app.get('/api/scripture/:book/:chapter/:verse', (req, res) => {
        try {
            const parts = req.params.verse.split('-');
            let verses;
            if (parts.length === 2) {
                verses = database.getVerseRange(req.params.book, parseInt(req.params.chapter), parseInt(parts[0]), parseInt(parts[1]));
            } else {
                const single = database.getScripture(req.params.book, parseInt(req.params.chapter), parseInt(parts[0]));
                verses = single ? [single] : [];
            }
            res.json({ verses });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Start server
    const server = app.listen(UI_PORT, '127.0.0.1', () => {
        log('INFO', `Web UI available at http://localhost:${UI_PORT}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            log('WARN', `Port ${UI_PORT} in use — UI may already be running`);
        } else {
            log('ERROR', `Web UI server error: ${err.message}`);
        }
    });

    return server;
}

// ---------------------------------------------------------------------------
// MCP Protocol Handler
// ---------------------------------------------------------------------------

async function handleMessage(message) {
    const { method, id, params = {} } = message;

    // --- Initialize ---
    if (method === 'initialize') {
        log('INFO', `Initializing ${SERVER_NAME} v${VERSION}`);
        log('INFO', `Data path: ${DATA_PATH}`);

        // First-run: copy bundled DB if needed
        ensureDataPath();

        // Configure modules (both async — sql.js needs WASM init)
        await database.configure(DATA_PATH);
        await embeddings.configure(DATA_PATH);
        await auth.configure(DATA_PATH, UI_PASSWORD);

        // Start web UI
        startWebUI();

        // Embed any nodes missing vectors (background)
        search.embedMissing().then(result => {
            if (result.total > 0) {
                log('INFO', `Background embed: ${result.embedded}/${result.total} nodes`);
            }
        }).catch(err => log('WARN', `Background embed error: ${err.message}`));

        return {
            jsonrpc: '2.0',
            id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: {
                    name: SERVER_NAME,
                    version: VERSION,
                    description: 'KARP Word Graph — Scripture study companion. You have access to the complete KJV Bible (31,102 verses, 66 books) with semantic search that finds passages by meaning. The user\'s study notes, prayers, and insights persist between conversations in a personal knowledge graph. Be a thoughtful study partner: check their study_history to pick up where they left off, present scripture reverently, suggest connections between passages, and offer to save reflections. IMPORTANT: Always show scripture text to the user before doing graph work. After each study_passage or search_scripture call, STOP and present the passage with your reflections — let them read the Word — then save notes. Never chain more than 2-3 tool calls without showing the user something to read. The web UI at localhost:3457 visualizes their study graph. Built by SoulDriver — "Search the Scriptures" (John 5:39).'
                }
            }
        };
    }

    // --- Initialized notification ---
    if (method === 'notifications/initialized') {
        log('INFO', 'Client connected — Claude Desktop is ready');
        return null;
    }

    // --- List tools ---
    if (method === 'tools/list') {
        return {
            jsonrpc: '2.0',
            id,
            result: { tools: TOOLS }
        };
    }

    // --- Call tool ---
    if (method === 'tools/call') {
        const toolName = params.name || '';
        const toolArgs = params.arguments || {};

        try {
            const result = await handleToolCall(toolName, toolArgs);
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                }
            };
        } catch (err) {
            log('ERROR', `Tool error [${toolName}]: ${err.message}`);
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ error: err.message })
                    }],
                    isError: true
                }
            };
        }
    }

    // --- Ping ---
    if (method === 'ping') {
        return { jsonrpc: '2.0', id, result: {} };
    }

    // --- Unknown ---
    log('WARN', `Unknown method: ${method}`);
    return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
    };
}

// ---------------------------------------------------------------------------
// Main — stdio loop
// ---------------------------------------------------------------------------

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
        const message = JSON.parse(trimmed);
        const response = await handleMessage(message);
        if (response !== null) {
            process.stdout.write(JSON.stringify(response) + '\n');
        }
    } catch (err) {
        log('ERROR', `Parse error: ${err.message}`);
    }
});

log('INFO', `${SERVER_NAME} v${VERSION} starting (stdio mode)`);
log('INFO', `Data: ${DATA_PATH} | UI: http://localhost:${UI_PORT}`);
