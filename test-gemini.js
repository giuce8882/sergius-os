import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyCh4r2zsHV3k2wUvW0Vq0ejCZXIJPLMepA');
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

async function test() {
    try {
        const result = await model.generateContent("Hello");
        console.log(result.response.text());
    } catch (e) {
        console.error(e.message);
    }
}
test();
