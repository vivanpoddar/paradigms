import {
    LlamaParseReader,
    // we'll add more here later
} from "llamaindex";
import 'dotenv/config'

export default async function parse(filePath?: string) {

    // Use provided path or default to notes.pdf
    const path = filePath || "./notes.pdf";

    // set up the llamaparse reader
    const reader = new LlamaParseReader({ 
        resultType: "markdown", 
        apiKey: process.env.LLAMA_CLOUD_API_KEY 
    });

    // parse the document
    const documents = await reader.loadData(path);

    return documents;
}