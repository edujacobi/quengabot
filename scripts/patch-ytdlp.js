const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../node_modules/@distube/yt-dlp/dist/index.js');

if (!fs.existsSync(targetFile)) {
  console.log('[patch-ytdlp] Target file not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(targetFile, 'utf8');

const targetCode = `    process2.stderr?.on("data", (chunk) => {
      output += chunk;
    });
    process2.on("close", (code) => {
      if (code === 0) resolve(JSON.parse(output));
      else reject(new Error(output));
    });`;

const replacementCode = `    let stdErrOutput = "";
    process2.stderr?.on("data", (chunk) => {
      stdErrOutput += chunk;
    });
    process2.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch (err) {
          reject(new Error("Failed to parse yt-dlp JSON output: " + err.message + "\\nOutput was: " + output));
        }
      }
      else reject(new Error(stdErrOutput || output));
    });`;

if (content.includes(targetCode)) {
  content = content.replace(targetCode, replacementCode);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('[patch-ytdlp] Successfully patched @distube/yt-dlp to separate stdout and stderr!');
} else if (content.includes('let stdErrOutput = ""')) {
  console.log('[patch-ytdlp] File is already patched.');
} else {
  console.warn('[patch-ytdlp] Warning: Target code pattern not found in index.js. The package may have been updated or structure changed.');
}
