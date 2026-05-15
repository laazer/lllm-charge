// Debug script for title parsing logic
const header = "# PY-004: MCP Server Migration to FastMCP";

// Current parsing logic from AutomaticTaskPickupSkill
const titleMatch = header;
const titleParts = titleMatch ? titleMatch.slice(2).split(': ') : ['Unknown', 'Unknown Task'];
const id = titleParts[0] || 'default-id';
const title = titleParts.slice(1).join(': ') || 'Unknown Task';

console.log('Original header:', header);
console.log('After slice(2):', titleMatch.slice(2));
console.log('Title parts:', titleParts);
console.log('Extracted ID:', id);
console.log('Extracted title:', title);

// Expected results:
// - ID should be: 'PY-004'
// - Title should be: 'MCP Server Migration to FastMCP'