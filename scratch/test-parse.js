const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'UserList.json');
const content = fs.readFileSync(filePath, 'utf8');

function cleanUserListJson(rawJson) {
  return rawJson.replace(/"roles"\s*:\s*\[\s*\{([\s\S]*?)\}\s*\]/g, (match, rolesContent) => {
    const roleRegex = /"role"\s*:\s*\{\s*"name"\s*:\s*"[^"]+"\s*\}/g;
    const matches = rolesContent.match(roleRegex);
    if (matches && matches.length > 0) {
      const wrapped = matches.map(m => `{ ${m} }`).join(',\n      ');
      return `"roles": [\n      ${wrapped}\n    ]`;
    }
    return match;
  });
}

const cleaned = cleanUserListJson(content);

try {
  // Verify it parses successfully
  const parsed = JSON.parse(cleaned);
  console.log("Successfully parsed cleaned JSON! Total users:", parsed.length);
  
  // Format with 2 spaces indentation
  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
  console.log("Successfully wrote cleaned JSON back to data/UserList.json");
} catch (e) {
  console.error("Failed to parse/write cleaned JSON:", e);
}
