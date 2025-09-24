// Map to the elements used in the current HTML
const chatBox = document.getElementById('messages');
const input = document.getElementById('input');
const btn = document.getElementById('sendBtn');

function appendMessage(sender, message) {
  const p = document.createElement('div');
  p.className = `message ${sender}`;
  p.textContent = message;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.textContent = isLoading ? '…' : 'Send';
}

async function sendMessage() {
  const msg = (input.value || '').trim();
  if (!msg) return;
  appendMessage('user', msg);
  input.value = '';
  setLoading(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      appendMessage('bot', err.error || 'Server error');
      return;
    }

    const data = await res.json();
    appendMessage('bot', data.reply || 'No reply');
  } catch (err) {
    console.error('Chat send error:', err);
    appendMessage('bot', 'Error connecting to bot server.');
  } finally {
    setLoading(false);
  }
}

// Click handler
btn.addEventListener('click', sendMessage);

// Send on Enter (not Shift+Enter)
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
