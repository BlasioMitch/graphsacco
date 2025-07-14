import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mergeResolvers } from "@graphql-tools/merge";
import fg from "fast-glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getResolvers = async () => {
  // Find all .ts resolver files using fast-glob
  const files = await fg([
  path.join(__dirname, './**/*.ts'),
  `!${path.join(__dirname, 'index.ts')}`
]);
  // Dynamically import each file using file URLs
  const modules = await Promise.all(
    files.map(async (file) => {
      const mod = await import(pathToFileURL(file).href);
      return mod.default || mod;
    })
  );
  return mergeResolvers(modules);
}