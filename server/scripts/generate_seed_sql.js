import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, '../sql/seed.sql');

let sql = '';

sql += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

// Users
sql += '-- Users\n';
sql += 'TRUNCATE TABLE user;\n';
for (let i = 1; i <= 40; i++) {
  sql += `INSERT INTO user (name, email, password) VALUES ('User_${i}', 'user${i}@example.com', 'password123');\n`;
}
sql += '\n';

// Workspaces
sql += '-- Workspaces\n';
sql += 'TRUNCATE TABLE workspace;\n';
const models = ['gpt-4', 'claude-3-opus', 'gemini-pro', 'llama-3'];
for (let i = 1; i <= 40; i++) {
  const model = models[i % models.length];
  sql += `INSERT INTO workspace (title, model) VALUES ('Workspace Project ${i}', '${model}');\n`;
}
sql += '\n';

// Notes
sql += '-- Notes\n';
sql += 'TRUNCATE TABLE note;\n';
for (let i = 1; i <= 40; i++) {
  const keywords = JSON.stringify(['tag' + i, 'important', 'work']);
  sql += `INSERT INTO note (title, keywords, content) VALUES ('Note Title ${i}', '${keywords}', 'This is the content for note ${i}. It contains some sample text.');\n`;
}
sql += '\n';

// Chats
// Assuming workspace IDs are 1-40 after truncate
sql += '-- Chats\n';
sql += 'TRUNCATE TABLE chat;\n';
for (let i = 1; i <= 40; i++) {
  const workspaceId = Math.floor(Math.random() * 40) + 1;
  const proposer = i % 2 === 0 ? 'user' : 'assistant';
  sql += `INSERT INTO chat (workspace_id, proposer, content) VALUES (${workspaceId}, '${proposer}', 'This is a chat message ${i} for workspace ${workspaceId}.');\n`;
}

sql += '\nSET FOREIGN_KEY_CHECKS = 1;\n';

fs.writeFileSync(outputFile, sql);
console.log(`Generated seed.sql at ${outputFile}`);
