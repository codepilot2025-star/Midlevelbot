const fs = require('fs');
// Use the project's adapters — fall back if not present
let getHFResponse;
try {
    ({ getHuggingFaceResponse: getHFResponse } = require('../nlp/botHuggingFace'));
} catch (e) {
    // safe local fallback
    getHFResponse = async (msg) => `LOCAL-HF-FALLBACK: ${String(msg).slice(0, 120)}`;
}
// If no Hugging Face API key is present, force local fallback to avoid 401s
if (!process.env.HUGGINGFACE_API_KEY) {
    getHFResponse = async (msg) => `LOCAL-HF-FALLBACK: ${String(msg).slice(0, 120)}`;
}

let getOpenAIResponse;
try {
    ({ getOpenAIResponse } = require('../nlp/botOpenAI'));
} catch (e) {
    getOpenAIResponse = async (msg) => `LOCAL-OPENAI-FALLBACK: ${String(msg).slice(0, 120)}`;
}
// If no OpenAI key is set, use local fallback (prevents accidental network calls)
if (!process.env.OPENAI_API_KEY) {
    getOpenAIResponse = async (msg) => `LOCAL-OPENAI-FALLBACK: ${String(msg).slice(0, 120)}`;
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
