const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const COMMENT_NODE = 8; // nodeType

const htmlfiledir = '../source/'

fs.readdir(htmlfiledir, function(err, files){
    if (err) throw err;
    const htmlfiles = files.filter(file => { return /.*\.html$/.test(file);});
    htmlfiles.forEach(file => {
        JSDOM.fromFile(htmlfiledir + file).then(dom => {
            let document = dom.window.document;
            let mainDiv = document.body.childNodes[0];
            let mainChildren = mainDiv.childNodes;
        
            for(let i =0; i < mainChildren.length; i++){
                let node = mainChildren[i];
                if(node.nodeType !== COMMENT_NODE) continue;
                console.log(node.data);
//                node.parentNode.replaceChild(document.createElement("br"), node);
            }
//            console.log(dom.serialize());
        });
    });
});
console.log("done");
