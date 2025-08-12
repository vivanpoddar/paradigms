import { GoogleAuth } from "google-auth-library";
import fs from 'fs'
import { writeFile } from 'fs/promises';


const auth = new GoogleAuth({
            keyFile: '/Users/vpoddar/Documents/learnai/serviceaccount.json',
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
const client = await auth.getClient();
const accessToken = await client.getAccessToken();


const fileBuffer = await fs.promises.readFile("/Users/vpoddar/Downloads/b7c0cf5-675e-fada-54e3-aa1b3c4176e_US-history-reconstruction-worksheet.pdf");
const base64Content = fileBuffer.toString('base64');

const requestBody = {       
    "rawDocument": {
    "mimeType": "application/pdf",
        "content": base64Content
    },    
};

const response = await fetch(
'https://us-documentai.googleapis.com/v1/projects/39073705270/locations/us/processors/1ef30fee3f5f7c68:process',
    {
        method: 'POST',
        headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    }
);

const result = await response.json();

// Write the result to a file
await writeFile("/Users/vpoddar/Documents/learnai/app/api/nparse/document_ai_output.json", JSON.stringify(result, null, 2), "utf-8");
console.log("Document AI response written to document_ai_output.json");

let parsedJson = {
    "page": []
};

const llmData = result.document
const entities = llmData.entities;
console.log("Parsed LLM Data:", llmData);

llmData.pages.forEach((page, pageIndex) => {
    parsedJson.page.push({ lines: [], pageWidth: page.dimension.width, pageHeight: page.dimension.height });
})

entities.forEach((page, pageIndex) => {
    const pageWidth = parsedJson.page[pageIndex].pageWidth;
    const pageHeight = parsedJson.page[pageIndex].pageHeight;
    page.properties.forEach((entity, entityIndex) => {
        const vertices = entity.pageAnchor.pageRefs[0].boundingPoly.normalizedVertices;
        const topLeft = vertices[0];
        const bottomRight = vertices[2];


        parsedJson.page[pageIndex].lines.push({
            "text": entity.mentionText,
            "type": "text",
            "textType": "Q",
            "region": {
                "top_left_x": Math.round(topLeft.x * pageWidth),
                "top_left_y": Math.round(topLeft.y * pageHeight),
                "width": Math.round((bottomRight.x - topLeft.x) * pageWidth),
                "height": Math.round((bottomRight.y - topLeft.y) * pageHeight)
            },
            "line": entityIndex,
        });
    });
});

console.log(JSON.stringify(parsedJson, null, 2));


// llmData.forEach((page, pageIndex) => {
//     let currentPage = pageIndex;
//     parsedJson.page.push({ lines: [], pageWidth: pages[pageIndex].page_width, pageHeight: pages[pageIndex].page_height });
//     page.forEach((group, groupIndex) => {
//         let textType = group[group.length - 1];
//         let mergedText = "";
//         let type = pages[pageIndex].lines[group[0]].type;
//         let regionsArray = [];
//         let column = pages[pageIndex].lines[group[0]].column;
//         let line = pages[pageIndex].lines[group[0]].line;
//         for (let i = 0; i < group.length - 1; i++) {
//             mergedText += pages[pageIndex].lines[group[i]].text + " ";
//             regionsArray.push(pages[pageIndex].lines[group[i]].region);
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
// })

console.log(JSON.stringify(parsedJson, null, 2));
