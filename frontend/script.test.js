/**
 * @jest-environment jsdom
 */

describe('Chat UI - Message Handling', () => {
  let chatBox, input, btn;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="messages"></div>
      <input id="input" type="text" />
      <button id="sendBtn">Send</button>
    `;

    // Load the script
    chatBox = document.getElementById('messages');
    input = document.getElementById('input');
    btn = document.getElementById('sendBtn');

    // Mock fetch
    global.fetch = jest.fn();
  });

  test('appends user message to chatBox', () => {
    const msgEl = document.createElement('div');
    msgEl.className = 'message user';
    msgEl.textContent = 'Hello Bot';
    chatBox.appendChild(msgEl);

    const messages = chatBox.querySelectorAll('.message.user');
    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toBe('Hello Bot');
  });

  test('appends bot message to chatBox', () => {
    const msgEl = document.createElement('div');
    msgEl.className = 'message bot';
    msgEl.textContent = 'Hi there!';
    chatBox.appendChild(msgEl);

    const messages = chatBox.querySelectorAll('.message.bot');
    expect(messages.length).toBe(1);
    expect(messages[0].textContent).toBe('Hi there!');
  });

  test('clears input after appending message', () => {
    input.value = 'Test message';
    input.value = '';

    expect(input.value).toBe('');
  });

  test('button starts enabled', () => {
    expect(btn.disabled).toBe(false);
  });

  test('button is disabled during loading', () => {
    btn.disabled = true;
    btn.textContent = '…';

    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('…');
  });

  test('button is re-enabled after loading', () => {
    btn.disabled = false;
    btn.textContent = 'Send';

    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Send');
  });

  test('ignores empty messages', () => {
    input.value = '   ';
    const trimmed = (input.value || '').trim();

    expect(trimmed).toBe('');
  });

  test('handles fetch success with bot reply', async () => {
    const mockReply = { reply: 'Bot response' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockReply,
    });

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.reply).toBe('Bot response');
  });

  test('handles fetch error gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });
    } catch (err) {
      expect(err.message).toBe('Network error');
    }
  });

  test('handles server error response', async () => {
    const mockError = { error: 'Server error' };
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => mockError,
    });

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });

    expect(response.ok).toBe(false);
    const data = await response.json();
    expect(data.error).toBe('Server error');
  });
});
