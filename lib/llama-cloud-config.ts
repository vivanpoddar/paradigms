/**
 * Configuration for LlamaCloudIndex integration
 */
export const LLAMA_CLOUD_CONFIG = {
  name: "paradigm",
  projectName: "Default",
  organizationId: "99f533dc-e4b9-4270-b176-6fe3cd20578b",
  apiKey: process.env.LLAMA_CLOUD_API_KEY,
  retrieverConfig: {
    similarityTopK: 5,
  },
  queryTriggers: [
    '?', 'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'explain', 'describe', 'tell me', 'find', 'search', 'look up',
    'can you', 'could you', 'please', 'help me'
  ]
} as const;

export type LlamaCloudConfig = typeof LLAMA_CLOUD_CONFIG;
