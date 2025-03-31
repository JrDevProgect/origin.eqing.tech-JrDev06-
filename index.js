const { ChatClient } = require('./chatService');

async function main() {
  const nonStreamClient = new ChatClient({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    presence_penalty: 0,
    frequency_penalty: 0,
    top_p: 1,
    chat_token: 72,
    stream: false
  });

  const streamClient = new ChatClient({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    presence_penalty: 0,
    frequency_penalty: 0,
    top_p: 1,
    chat_token: 72,
    stream: true
  });

  const messages = [
    {
      role: 'system',
      content: `\nCurrent model: gpt-4o-mini\nCurrent time: ${new Date().toString()}\nLatex inline: $ x^2 $ \nLatex block: $$ e=mc^2 $$\n\n`
    },
    { role: 'user', content: 'hi' }
  ];

  try {
    console.log('Non-streaming response:');
    const nonStreamResponse = await nonStreamClient.createChatCompletion({ messages });
    console.log(JSON.stringify(nonStreamResponse, null, 2));

    console.log('\nStreaming response:');
    const stream = await streamClient.createChatCompletion({ messages });
    stream.on('data', chunk => {
      const parsed = JSON.parse(chunk);
      console.log('Chunk:', JSON.stringify(parsed, null, 2));
    });
    stream.on('end', () => console.log('Stream ended'));
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

main();