const fs = require('fs');
const path = require('path');
const dir = './Frontend/src';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));
files.forEach(f => {
    const p = path.join(dir, f);
    let content = fs.readFileSync(p, 'utf8');
    if (content.includes('http://localhost:8080')) {
        content = content.replace(/"http:\/\/localhost:8080/g, '`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "');
        content = content.replace(/`http:\/\/localhost:8080/g, '`${import.meta.env.VITE_API_URL || "http://localhost:8080"}');
        fs.writeFileSync(p, content);
        console.log('Updated ' + f);
    }
});
