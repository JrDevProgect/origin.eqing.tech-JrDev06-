const axios = require('axios');
const { getCaptchaToken } = require('./captchaService');
const { Readable } = require('stream');

class ChatClient {
  constructor(defaultOptions = {}) {
    this.defaultOptions = {
      model: defaultOptions.model || 'gpt-4o-mini',
      temperature: defaultOptions.temperature || 1.0,
      presence_penalty: defaultOptions.presence_penalty || 0,
      frequency_penalty: defaultOptions.frequency_penalty || 0,
      top_p: defaultOptions.top_p || 1.0,
      chat_token: defaultOptions.chat_token || 72,
      stream: defaultOptions.stream !== undefined ? defaultOptions.stream : false
    };
  }

  async createChatCompletion({ messages, model, temperature, presence_penalty, frequency_penalty, top_p, chat_token }) {
    const config = {
      model: model || this.defaultOptions.model,
      temperature: temperature !== undefined ? temperature : this.defaultOptions.temperature,
      presence_penalty: presence_penalty !== undefined ? presence_penalty : this.defaultOptions.presence_penalty,
      frequency_penalty: frequency_penalty !== undefined ? frequency_penalty : this.defaultOptions.frequency_penalty,
      top_p: top_p !== undefined ? top_p : this.defaultOptions.top_p,
      chat_token: chat_token || this.defaultOptions.chat_token,
      stream: this.defaultOptions.stream
    };

    const captchaToken = await getCaptchaToken();
    if (!captchaToken) throw new Error('Failed to solve captcha');

    const payload = {
      messages,
      model: config.model,
      stream: true,
      temperature: config.temperature,
      presence_penalty: config.presence_penalty,
      frequency_penalty: config.frequency_penalty,
      top_p: config.top_p,
      chat_token: config.chat_token,
      captchaToken
    };

    const response = await axios.post('https://origin.eqing.tech/api/openai/v1/chat/completions', payload, {
      headers: {
        accept: 'text/event-stream',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        plugins: '0',
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        usesearch: 'false',
        'x-requested-with': 'XMLHttpRequest'
      },
      referrer: 'https://origin.eqing.tech/',
      withCredentials: true,
      responseType: 'stream'
    });

    return config.stream ? this.createStream(response.data) : this.collectFullResponse(response.data);
  }

  createStream(stream) {
    const readable = new Readable({ objectMode: true, read() {} });
    let fullContent = '';
    let metadata = {};

    stream.on('data', chunk => {
      const buffer = chunk.toString();
      const lines = buffer.split('\n');

      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            const finalResponse = {
              id: metadata.id,
              object: 'chat.completion',
              created: metadata.created,
              model: metadata.model,
              choices: [{
                message: { role: 'assistant', content: fullContent },
                finish_reason: 'stop'
              }]
            };
            readable.push(JSON.stringify(finalResponse));
            readable.push(null);
          } else if (data) {
            try {
              const parsed = JSON.parse(data);
              metadata.id = parsed.id || metadata.id;
              metadata.created = parsed.created || metadata.created;
              metadata.model = parsed.model || metadata.model;
              const content = parsed.choices[0]?.delta?.content || '';
              fullContent += content;

              const chunkResponse = {
                id: metadata.id,
                object: 'chat.completion',
                created: metadata.created,
                model: metadata.model,
                choices: [{
                  message: { role: 'assistant', content: fullContent },
                  finish_reason: parsed.choices[0]?.finish_reason || null
                }]
              };
              readable.push(JSON.stringify(chunkResponse));
            } catch (e) {
            }
          }
        }
      });
    });

    stream.on('end', () => {
      if (!readable.readableEnded) {
        const finalResponse = {
          id: metadata.id,
          object: 'chat.completion',
          created: metadata.created,
          model: metadata.model,
          choices: [{
            message: { role: 'assistant', content: fullContent },
            finish_reason: 'stop'
          }]
        };
        readable.push(JSON.stringify(finalResponse));
        readable.push(null);
      }
    });

    stream.on('error', err => readable.emit('error', err));

    return readable;
  }

  async collectFullResponse(stream) {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let metadata = {};

      stream.on('data', chunk => {
        const buffer = chunk.toString();
        const lines = buffer.split('\n');

        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                metadata.id = parsed.id || metadata.id;
                metadata.created = parsed.created || metadata.created;
                metadata.model = parsed.model || metadata.model;
                const content = parsed.choices[0]?.delta?.content || '';
                fullContent += content;
                if (parsed.choices[0]?.finish_reason === 'stop') {
                  metadata.finish_reason = 'stop';
                }
              } catch (e) {
              }
            }
          }
        });
      });

      stream.on('end', () => {
        const fullResponse = {
          id: metadata.id,
          object: 'chat.completion',
          created: metadata.created,
          model: metadata.model,
          choices: [{
            message: { role: 'assistant', content: fullContent },
            finish_reason: metadata.finish_reason || 'stop'
          }]
        };
        resolve(fullResponse);
      });

      stream.on('error', err => reject(err));
    });
  }
}

module.exports = { ChatClient };
