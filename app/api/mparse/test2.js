import { readFile } from "fs/promises";
import { Group } from "lucide-react";

let llmData = await readFile("/Users/vpoddar/Documents/learnai/app/api/parse/llm_output.json", "utf8");
let parsedData = await readFile("/Users/vpoddar/Documents/learnai/app/api/parse/input.json", "utf8");
parsedData = JSON.parse(parsedData);
llmData = JSON.parse(llmData);

const pages = parsedData.pages;
const joinedGroups = llmData;


// let globalLineIndex = 0;
// for(let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
//     for(let lineIndex = 0; lineIndex < pages[pageIndex].lines.length; lineIndex++) {
//         console.log(pages[pageIndex].lines[lineIndex].text);
//         globalLineIndex++;
//     }
// }

let parsedJson = {
    "page": []
};

let mergeBoundingBoxes = (regions) => {
    if (!regions || regions.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    regions.forEach((region) => {
        const x = region.top_left_x;
        const y = region.top_left_y;
        const width = region.width;
        const height = region.height;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
    });

    return {
        region: {
            top_left_x: minX,
            top_left_y: minY,
            width: maxX - minX,
            height: maxY - minY
        }
    };
};

llmData.forEach((page, pageIndex) => {
    let currentPage = pageIndex;
    parsedJson.page.push({ lines: [], pageWidth: pages[pageIndex].page_width, pageHeight: pages[pageIndex].page_height });
    page.forEach((group, groupIndex) => {
        let textType = group[group.length-1];
        let mergedText = "";
        let type = pages[pageIndex].lines[group[0]].type;
        let regionsArray = [];
        let column = pages[pageIndex].lines[group[0]].column;
        let line = pages[pageIndex].lines[group[0]].line;
        for(let i = 0; i<group.length-1; i++) {
            mergedText += pages[pageIndex].lines[group[i]].text + " ";
            regionsArray.push(pages[pageIndex].lines[group[i]].region);
        }
        parsedJson.page[currentPage].lines.push({
            "text": mergedText.trim(),
            "type": type,
            "textType": textType,
            "region": mergeBoundingBoxes(regionsArray),
            "line": line,
            "column": column
        });
    })
})

console.log(JSON.stringify(parsedJson, null, 2));



// joinedGroups.forEach((page, pageIndex) => {
//     let currentPage = pageIndex
//     parsedJson.page.push({ lines: [] });
//     page.joinedGroups.forEach((joinedGroup, lineIndex) => {
//         let mergedText = "";
//         let type = ""
//         let textType = "";
//         let regionsArray = [];
//         let column = "";
//         let line = "";
//         for (let groupIndex = page.joinedGroups[lineIndex].length - 1; groupIndex >= 0; groupIndex--) {
//             let group = joinedGroup[groupIndex];
//             //console.log(`Processing page ${pageIndex + 1}, line ${lineIndex + 1}, group ${group}`);
//             mergedText = pages[pageIndex].lines[group].text + " " + mergedText;
//             type = pages[pageIndex].lines[group].type;
//             textType = page.category[lineIndex]
//             regionsArray.push(pages[pageIndex].lines[group].region)
//             column = pages[pageIndex].lines[group].column;
//             line = pages[pageIndex].lines[group].line;
//         }
//         parsedJson.page[currentPage].lines.push({
//             "text": mergedText.trim(),
//             "type": type,
//             "textType": textType,
//             "region": mergeBoundingBoxes(regionsArray),
//             "line": line,
//             "column": column
//         });
//     })
// });