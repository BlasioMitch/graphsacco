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

// Dynamically load all .graphql files from src/schemas
export const getTypeDefs = async () => {
    const files = await fg([path.join(process.cwd(), "src/schemas/**/*.graphql")]);
    const typeDefsArray = files.map(file => readFileSync(file, "utf8"));
    return mergeTypeDefs(typeDefsArray);
};

// Usage example (if you need to export typeDefs directly):
export const typeDefs = await getTypeDefs();