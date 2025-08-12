const systemPrompt = `
//             You are given a list of lines from a highschooler's math homework. Each line may be:
//             - A complete question
//             - Part of a question that spans multiple consecutive lines
//             - A statement that is not a question
//             Your task:
//             - Identify which lines are part of questions
//             - Group together consecutive question lines that belong to the same question into a single group.
//             - Ignore and exclude all non-question lines.
//             `;

//             const ai = new GoogleGenAI({
//               apiKey: process.env.GEMINI_API_KEY
//             });

//               const response = await ai.models.generateContent({
//                 model: "gemini-2.5-flash",
//                 contents: `Here is the list of items:\n${result}\n\nPlease analyze the items and provide your response.`,
//                 config: {
//                   responseMimeType: "application/json",
//                   responseSchema: {
//                     type: "array",
//                     items: {
//                       type: "array",
//                       description: "The page of the line group.",
//                       items: {
//                         type: "array",
//                         items: {
//                           type: "integer",
//                           description: "The list of lines of a single question, joined together by their Item #. Example: [[0,1], [2,3,7], [4]]"
//                         }
//                       }
//                     },
//                   },
//                   systemInstruction: systemPrompt,
//                   thinkingConfig: {
//                     thinkingBudget: 0, // Disables thinking
//                   },
//                 }
//               });

//               let llmData;
//                 llmData = JSON.parse(
//                   response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
//                 );
//                 console.error("Failed to parse LLM response:", e, response);
//                 llmData = {};
              
            
        