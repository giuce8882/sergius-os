import fs from 'fs';
import { parse } from '@babel/parser';

const source = fs.readFileSync('./src/App.jsx', 'utf-8');

try {
    parse(source, {
        sourceType: 'module',
        plugins: ['jsx']
    });
    console.log("Parse Success!");
} catch (e) {
    console.log("Parse Error at line", e.loc.line, "col", e.loc.column);
    console.log(e.message);

    const lines = source.split('\n');
    const start = Math.max(0, e.loc.line - 10);
    const end = Math.min(lines.length, e.loc.line + 10);
    for (let i = start; i < end; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
