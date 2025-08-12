import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile } from "fs/promises";

let result = await readFile("/Users/vpoddar/Documents/learnai/app/api/mparse/llm.txt", "utf-8");

console.log ("LLM Output:", result);

const systemPrompt = `
            You are a helpful assistant.Your task is to analyze a list of items extracted from a math homework document of a school student. Follow these steps: \n
            1. ** Determine Joining **: First, decide if any items should be joined together because they are part of the same logical statement or context (e.g., split across multiple lines). If so, merge them into a group. \n
            Do not treat answer choices (e.g., A, B, C, D) as separate groups by themselves. Instead, always include answer choices in the same group as their corresponding question.\n
            2. **Categorize Each Item**: For each group, determine its category:\n
              - **Question**: The group requires input or action from the reader, most commonly a question.\n
              - **Relevant**: The group is relevant information needed to solve a question but does not itself require action. \n
              - **Irrelevant**: The group is irrelevant or does not contribute to solving the problem.
            3. Only include items in the response that are part of the "question" category.
            `;

            const ai = new GoogleGenAI({
                apiKey: "AIzaSyDIzX8ebtFJbHYIZnF687p4HCYk8XJy8-8"
            });

              const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Here is the list of items:\n${result}\n\nPlease analyze the items and provide your response.`,
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
                          type: "integer",
                            description: "The list of joined groups by their Item #."
                        }
                      }
                    },
                  },
                  systemInstruction: systemPrompt,
                  thinkingConfig: {
                    thinkingBudget: 0,
                  },
                }
              });

              let llmData;
              try {
                llmData = JSON.parse(
                  response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
                );
                // Write the LLM data to a file
                await writeFile("/Users/vpoddar/Documents/learnai/app/api/mparse/llm_output.json", JSON.stringify(llmData, null, 2), "utf-8");
                console.log("LLM data written to llm_output.json");
              } catch (e) {
                console.error("Failed to parse LLM response:", e, response);
                llmData = {};
              }




