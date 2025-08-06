import { readFile } from "fs/promises";

let result = await readFile("/Users/vpoddar/Documents/learnai/app/api/parse/input.json", "utf-8");
result = JSON.parse(result);

let itemNumber = 0;


const formattedLines = result.pages.flatMap((page, pageIndex) => {
    if (Array.isArray(page.lines)) {
        return page.lines.map((line, lineIndex) => {
            itemNumber++;
            if (line && line.text !== "" && line.text != null) {
                return `Item #${lineIndex}, Page ${pageIndex}: ${line.text}`;
            }
            return undefined;
        }).filter(Boolean);
    }
    return [];
});

const linesForLLM = formattedLines.join('\n');
console.log(linesForLLM)