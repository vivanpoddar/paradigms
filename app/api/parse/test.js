import { GoogleGenAI } from "@google/genai";
import { readFile } from "fs/promises"; // Node.js file system promises API

const systemPrompt = `
            You are a helpful assistant.Your task is to analyze a list of items extracted from a math homework document of a school student. Follow these steps: \n
            1. ** Determine Joining **: First, decide if any items should be joined together because they are part of the same logical statement or context (e.g., split across multiple lines). If so, merge them into a single item. If you find answer choices ex. (A), (B), (C), (D), include them in the same group as the question.\n
            2. **Categorize Each Item**: For each group, determine its category:\n
              - **Q**: The group is a question that requires input or action from the reader. A line of text including a mathematical expression is most likely part of a question.\n
              - **R**: The group is relevant information needed to solve a question but does not itself require action. \n
              - **I**: The group is irrelevant or does not contribute to solving the problem.           
            `;

const linesForLLM = await readFile("/Users/vpoddar/Documents/learnai/app/api/parse/llm.txt", "utf8");
          console.log(linesForLLM)

            const ai = new GoogleGenAI({
              apiKey: "AIzaSyDIzX8ebtFJbHYIZnF687p4HCYk8XJy8-8"
            });

            try {
              const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Here is the list of items:\n${linesForLLM}\n\nPlease analyze the items and provide your response.`,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "array",
                    items: {
                      type: "array",
                      description: "The page of the item group.",
                      items: {
                        type: "array",
                        items: {
                          type: "string",
                          description: "The list of joined groups by their Item #, followed by the category string ('Q', 'R', or 'I'). Example: [[0,1,Q], [2,3,R], [4,I]]"
                        }
                      }
                    },
                  },
                  systemInstruction: systemPrompt,
                  thinkingConfig: {
                    thinkingBudget: 0, // Disables thinking
                  },
                }
              });

              const fs = await import('fs/promises');
              const output = response.candidates[0].content.parts[0].text;
              await fs.writeFile("/Users/vpoddar/Documents/learnai/app/api/parse/llm_output.json", output, "utf8");
              console.log('LLM response saved to llm_output.json');
            } catch (error) {
                console.error('Error generating content:', error);
            }

