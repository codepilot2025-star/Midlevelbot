const fs = require('fs');
// Use the project's adapters — fall back if not present
let getHFResponse;
try {
    ({ getHuggingFaceResponse: getHFResponse } = require('../nlp/botHuggingFace'));
} catch (e) {
    // safe local fallback
    getHFResponse = async (msg) => `LOCAL-HF-FALLBACK: ${String(msg).slice(0, 120)}`;
}
// Decide whether to perform live network calls. CLI flag --live or env LIVE=true enables live mode.
const argv = process.argv.slice(2);
const LIVE_FLAG = String(process.env.LIVE || '').toLowerCase() === 'true' || argv.includes('--live');

// If no Hugging Face API key is present or we're not in live mode, force local fallback to avoid 401s
if (!LIVE_FLAG || !process.env.HUGGINGFACE_API_KEY) {
    getHFResponse = async (msg) => `LOCAL-HF-FALLBACK: ${String(msg).slice(0, 120)}`;
}

let getOpenAIResponse;
try {
    ({ getOpenAIResponse } = require('../nlp/botOpenAI'));
} catch (e) {
    getOpenAIResponse = async (msg) => `LOCAL-OPENAI-FALLBACK: ${String(msg).slice(0, 120)}`;
}
// If no OpenAI key is set or we're not in live mode, use local fallback (prevents accidental network calls)
if (!LIVE_FLAG || !process.env.OPENAI_API_KEY) {
    getOpenAIResponse = async (msg) => `LOCAL-OPENAI-FALLBACK: ${String(msg).slice(0, 120)}`;
}

if (!LIVE_FLAG) {
    console.log('run_tasks: running in SAFE mode (no external API calls). Use --live or LIVE=true to enable live calls.');
}

// If live mode is requested, require an interactive confirmation from the user before making live API calls.
async function confirmLive() {
    if (!LIVE_FLAG) return false;
    // If running non-interactively (CI), do not confirm and treat as false unless explicit env ALLOW_LIVE_IN_CI
    if (process.env.CI && String(process.env.ALLOW_LIVE_IN_CI || '').toLowerCase() !== 'true') {
        console.warn('LIVE mode requested but running in CI or non-interactive environment; skipping live calls.');
        return false;
    }
    // Interactive prompt
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => rl.question('You requested LIVE mode. Proceed with live API calls? (y/N): ', (a) => { rl.close(); resolve(a); }));
    return String(answer || '').toLowerCase().startsWith('y');
}

const taskList = [
    'Test CLI conversation flows',
    'Integrate frontend chat widget',
    'Verify API fallback logic',
    'Deploy bot to test server',
];

// Log errors to file
function logError(task, error) {
    const logMessage = `[${new Date().toISOString()}] Task: ${task} | Error: ${error && error.message ? error.message : String(error)}\n${error && error.stack ? error.stack : ''}\n`;
    fs.appendFileSync('error.log', logMessage, 'utf8');
}

async function askClaude(task) {
    try {
        const prompt = `Claude, review this task and provide guidance without executing: ${task}`;
        const response = await getHFResponse(prompt);
        console.log(`Claude: ${response}\n`);
    } catch (error) {
        console.error(`Error in askClaude for task "${task}":`, error && error.message ? error.message : error);
        logError(task, error);
    }
}

async function executeCopilot(task) {
    try {
        const prompt = `Copilot, execute the following task: ${task}`;
        const response = await getOpenAIResponse(prompt);
        console.log(`Copilot: ${response}\n`);
    } catch (error) {
        console.error(`Error in executeCopilot for task "${task}":`, error && error.message ? error.message : error);
        logError(task, error);
    }
}

async function runTasks() {
    for (let i = 0; i < taskList.length; i++) {
        const task = taskList[i];
        console.log(`\n=== TASK ${i + 1}: ${task} ===`);
        await askClaude(task); // advisory
        await executeCopilot(task); // execution
    }
}

if (require.main === module) {
    runTasks().catch((err) => {
        console.error('Unhandled error in runTasks:', err);
        process.exitCode = 1;
    });
}

module.exports = { runTasks };
