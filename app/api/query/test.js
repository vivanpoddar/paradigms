import { LlamaCloudIndex, Settings, ContextChatEngine } from "llamaindex";
import { openai } from "@llamaindex/openai";


    Settings.llm = openai({
      model:  "gpt-4o", // Use vision model if images provided
      temperature: 1,
      apiKey: process.env.OPENAI_API_KEY,
    });

const index = new LlamaCloudIndex({
    name: "cultural-cardinal-2025-10-01",
    projectName: "Default",
    organizationId: "99f533dc-e4b9-4270-b176-6fe3cd20578b",
    apiKey: "llx-cJOMWlOoE7UBMR0uiHJzBSOcFcMbGYOEe2h6yHYMT8M0pHkV",
});
const retriever = index.asRetriever({
    similarityTopK: 5,
});
const chatEngine = new ContextChatEngine({ retriever });

console.log(chatEngine);