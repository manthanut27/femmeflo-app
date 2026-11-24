import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(process.cwd(), 'src');

function resolveWithExtensions(basePath) {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    const candidate = basePath + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === 'expo-location') {
    return {
      url: new URL('./mock-expo-location.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'react-native') {
    return {
      url: new URL('./mock-react-native.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  if (specifier === 'expo-secure-store') {
    return {
      url: new URL('./mock-expo-secure-store.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }

  // Handle '@/...' path aliases mapping to 'src/...'
  if (specifier.startsWith('@/')) {
    const relativeTarget = specifier.slice(2);
    const resolvedPath = resolveWithExtensions(path.join(srcDir, relativeTarget));
    if (resolvedPath) {
      return {
        url: new URL(`file://${resolvedPath}`).href,
        shortCircuit: true,
      };
    }
  }

  // Handle relative imports without extension
  if (specifier.startsWith('.') && context.parentURL) {
    try {
      const parentPath = fileURLToPath(context.parentURL);
      const parentDir = path.dirname(parentPath);
      const candidateBase = path.resolve(parentDir, specifier);
      const resolvedPath = resolveWithExtensions(candidateBase);
      if (resolvedPath) {
        return {
          url: new URL(`file://${resolvedPath}`).href,
          shortCircuit: true,
        };
      }
    } catch {
      // Fall through to defaultResolve
    }
  }

  return defaultResolve(specifier, context);
}
