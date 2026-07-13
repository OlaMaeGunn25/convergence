const crypto = require('crypto');
const fs = require('fs');

try {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'openssh'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  fs.writeFileSync('id_rsa_github', privateKey);
  fs.writeFileSync('id_rsa_github.pub', publicKey);
  console.log('[+] SUCCESS: SSH key pair generated successfully.');
} catch (err) {
  console.error('[-] ERROR: Failed to generate SSH key pair:', err.message);
  process.exit(1);
}
