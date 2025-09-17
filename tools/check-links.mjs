#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

async function listHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(dir, entry.name));
}

function extractLinks(content) {
  const regex = /(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const attr = match[1];
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    if (!value) continue;
    matches.push({ attr, value });
  }
  return matches;
}

function shouldCheck(value) {
  const lower = value.toLowerCase();
  return !(
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('#') ||
    lower.startsWith('javascript:')
  );
}

function resolveTarget(htmlPath, value) {
  const [withoutQuery] = value.split('#');
  const [cleanValue] = withoutQuery.split('?');
  if (!cleanValue) {
    return null;
  }
  if (cleanValue.startsWith('/')) {
    return path.join(PUBLIC_DIR, cleanValue);
  }
  const baseDir = path.dirname(htmlPath);
  return path.resolve(baseDir, cleanValue);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkHtmlFile(htmlPath) {
  const content = await fs.readFile(htmlPath, 'utf8');
  const links = extractLinks(content);
  const missing = [];

  for (const { attr, value } of links) {
    if (!shouldCheck(value)) continue;
    const targetPath = resolveTarget(htmlPath, value);
    if (!targetPath) continue;
    const exists = await fileExists(targetPath);
    if (!exists) {
      missing.push({ attr, value });
    }
  }

  return missing;
}

async function main() {
  try {
    const htmlFiles = await listHtmlFiles(PUBLIC_DIR);
    let hasErrors = false;

    for (const htmlFile of htmlFiles) {
      const missingLinks = await checkHtmlFile(htmlFile);
      if (missingLinks.length === 0) {
        continue;
      }
      hasErrors = true;
      const relativeHtml = path.relative(process.cwd(), htmlFile);
      console.log(relativeHtml);
      for (const { attr, value } of missingLinks) {
        console.log(`  ${attr}="${value}" -> NOT FOUND`);
      }
    }

    if (!hasErrors) {
      console.log('All links OK');
    }

    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('Error while checking links:', error.message);
    process.exit(1);
  }
}

main();
