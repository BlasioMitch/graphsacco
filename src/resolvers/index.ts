import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mergeResolvers } from "@graphql-tools/merge";
import fg from "fast-glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getResolvers = async () => {
  // Find all resolver files using fast-glob (.ts in dev via ts-node, .js in compiled dist)
  const files = await fg([
  path.join(__dirname, './**/*.{ts,js}'),
  `!${path.join(__dirname, 'index.{ts,js}')}`,
  `!${path.join(__dirname, '**/*.d.ts')}`
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