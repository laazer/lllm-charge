const fs = require('fs');

// Read the test file
const testFile = '/Users/jacob.brandt/workspace/lllm-charge/tests/python-backend-architecture-foundation.test.ts';
let content = fs.readFileSync(testFile, 'utf-8');

// Clean up duplicate comments and add async keyword
content = content.replace(
  /(it\('should [^']+', \(\) => \{)\s+\/\/ Arrange\s+\/\/ Set up test data and expectations\s+\/\/ Act\s+\/\/ Execute the functionality being tested\s+\/\/ Assert\s+\/\/ Verify the expected behavior\s+(\/\/ Arrange\s+\/\/ Instance provided by beforeEach\s+\/\/ Act\s+const result = await [^;]+;\s+\/\/ Assert\s+expect\(result\)\.toBe\(true\);\s+\})/g,
  '$1 async () => {\n    // Arrange\n    // Instance provided by beforeEach\n    \n    // Act\n    const result = await instance.$2'
);

// Fix method calls to just use the method name part
content = content.replace(
  /const result = await instance\.(\/\/ Arrange[\s\S]*?const result = await [^.]+\.([^(]+)\([^)]*\);)/g,
  'const result = await instance.$2();'
);

// More precise cleanup - remove duplicate sections and add async keyword  
const testBlocks = content.split(/(?=it\('should [^']+', \(\) => \{)/);
let cleanedContent = testBlocks[0]; // Keep the header

for (let i = 1; i < testBlocks.length; i++) {
  let block = testBlocks[i];
  
  // Add async keyword
  block = block.replace(/it\('([^']+)', \(\) => \{/, "it('$1', async () => {");
  
  // Clean up duplicate comment sections
  block = block.replace(
    /\/\/ Arrange\s+\/\/ Set up test data and expectations\s+\/\/ Act\s+\/\/ Execute the functionality being tested\s+\/\/ Assert\s+\/\/ Verify the expected behavior\s+\/\/ Arrange\s+\/\/ Instance provided by beforeEach\s+\/\/ Act\s+(const result = await instance\.[^;]+;)\s+\/\/ Assert\s+(expect\(result\)\.toBe\(true\);)/,
    '// Arrange\n    // Instance provided by beforeEach\n    \n    // Act\n    $1\n    \n    // Assert\n    $2'
  );
  
  cleanedContent += block;
}

// Write the cleaned content
fs.writeFileSync(testFile, cleanedContent, 'utf-8');
console.log('✅ Test file cleaned up and async keywords added');