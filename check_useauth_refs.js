
import fs from 'fs';
import path from 'path';

const srcDir = 'c:/abu-mafhal-marketplace/web/src';

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(srcDir);

files.forEach(file => {
  if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check if useAuth is used as an identifier (not as part of a string or comment)
    // This is a simple heuristic: word boundary then useAuth
    const useAuthUsage = /\buseAuth\b/.test(content);
    
    if (useAuthUsage) {
      const hasImport = content.includes('import') && (content.includes('useAuth') || content.includes('* as useAuth'));
      const hasDefinition = content.includes('export const useAuth') || content.includes('function useAuth') || content.includes('const useAuth =');
      
      // Filter out some false positives like comments
      const lines = content.split('\n');
      let usedWithoutImport = false;
      let usageLines = [];

      lines.forEach((line, index) => {
        if (line.includes('useAuth') && !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.includes('import') && !line.includes('export const useAuth') && !line.includes('function useAuth') && !line.includes('const useAuth =')) {
          usedWithoutImport = true;
          usageLines.push(index + 1);
        }
      });

      if (usedWithoutImport) {
        // Re-check if the file has an import at all
        const hasActualImport = /import\s+.*useAuth.*from/.test(content);
        if (!hasActualImport && !hasDefinition) {
          console.log(`Potential ReferenceError in ${file} at lines: ${usageLines.join(', ')}`);
        }
      }
    }
  }
});
