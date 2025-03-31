const { TextEncoder } = require('util');
const crypto = require('crypto');

function bufferToHex(buffer) {
  return Buffer.from(buffer).toString('hex');
}

async function computeHash(input, number, algorithm) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input + number);
  return bufferToHex(crypto.createHash(algorithm.toLowerCase()).update(data).digest());
}

function solveChallenge(challenge, salt, algorithm = 'SHA-256', maxNumber = 1000000, start = 0) {
  let aborted = false;
  const startTime = Date.now();

  const promise = (async () => {
    for (let i = start; i <= maxNumber; i++) {
      if (aborted) return null;
      if (await computeHash(salt, i, algorithm) === challenge) {
        return { number: i, took: Date.now() - startTime };
      }
    }
    return null;
  })();

  return { promise, controller: { abort: () => { aborted = true; } } };
}

module.exports = { solveChallenge };
