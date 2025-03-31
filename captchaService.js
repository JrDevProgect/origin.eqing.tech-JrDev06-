const axios = require('axios');
const { solveChallenge } = require('./cryptoUtils');

async function getCaptchaToken() {
  const response = await axios.get('https://origin.eqing.tech/api/altcaptcha/challenge', {
    headers: {
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    },
    referrer: 'https://origin.eqing.tech/',
    referrerPolicy: 'strict-origin-when-cross-origin',
    withCredentials: true
  });

  const { challenge, salt, maxnumber, algorithm, signature } = response.data;
  const solver = solveChallenge(challenge, salt, algorithm, maxnumber);
  const result = await solver.promise;

  if (!result) return null;

  return Buffer.from(JSON.stringify({
    algorithm,
    challenge,
    number: result.number,
    salt,
    signature,
    took: result.took
  })).toString('base64');
}

module.exports = { getCaptchaToken };
