const fs = require('fs');
const path = require('path');

function replaceShadowWeb(content) {
    // Basic replacement for typical shadow styles
    return content.replace(/shadowColor:\s*['"][^'"]+['"],\s*(shadowOffset:\s*\{\s*width:\s*\d+,\s*height:\s*\d+\s*\},\s*)?shadowOpacity:\s*[0-9.]+,\s*(shadowRadius:\s*[0-9.]+,\s*)?(elevation:\s*\d+,?)?/g, "boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',");
}

function walk(dir, done) {
    let results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push(file);
                    if (!--pending) done(null, results);
                }
            });
        });
    });
}

walk('src', function (err, results) {
    if (err) throw err;
    results.filter(f => f.endsWith('.js')).forEach(f => {
        let content = fs.readFileSync(f, 'utf8');
        if (content.includes('shadowColor')) {
            let replaced = replaceShadowWeb(content);
            if (replaced !== content) {
                fs.writeFileSync(f, replaced);
                console.log('Replaced shadows in:', f);
            }
        }
    });
});
