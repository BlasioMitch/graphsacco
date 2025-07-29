// import { loadFilesSync } from "@graphql-tools/load-files";
// import { mergeTypeDefs } from "@graphql-tools/merge";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const typesArray = loadFilesSync(path.join(__dirname, "./**/*.graphql"));
// export const typeDefs = mergeTypeDefs(typesArray)

import path from "path";
import fg from "fast-glob";
import { mergeTypeDefs } from "@graphql-tools/merge";
import { readFileSync } from "fs";

const root = process.env.NODE_ENV === 'production' ? 'dist' : 'src';
// Dynamically load all .graphql files from src/schemas
    const files = fg.sync([path.join(process.cwd(), `${root}/schemas/**/*.graphql`)]);
    const typeDefsArray = files.map(file => readFileSync(file, "utf8"));

// Usage example (if you need to export typeDefs directly):
export const typeDefs = mergeTypeDefs(typeDefsArray);