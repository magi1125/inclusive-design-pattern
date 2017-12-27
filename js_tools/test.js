const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom; // JSDOM = jsdom.JSDOM;
const COMMENT_NODE = 8; // nodeType
const ELEMENT_NODE = 1; // nodeType
const COMMENT_PREFIX = 'translator_notes:';

const source_note_dir = '../translator_notes/';
const source_html_dir = '../source/';
const dest_dir = './temp/';


// Load note data
const text_files = fs.readdirSync(source_note_dir).filter(file => { return /\.txt$/.test(file);});
text_files.forEach(file => {
    const source_file_path = source_note_dir + file;
    const text = fs.readFileSync(source_file_path, 'utf8');
    const lines = text.split("\n");
    lines.forEach((line, index) =>{
        console.log(`${index}: ${line}`);
    });
});

// Process
const html_files = fs.readdirSync(source_html_dir).filter(file => { return /\.html$/.test(file);});
html_files.forEach(file => {
    const source_file_path = source_html_dir + file;
    const dest_file_path = dest_dir + file;
    JSDOM.fromFile(source_file_path).then(dom => {
        console.log(file);
        const document = dom.window.document;
        const mainDiv = document.body.childNodes[0];
        const mainChildren = mainDiv.childNodes;
        
        // 訳注の見出しレベルをいい感じにするために現在の見出しレベルを把握
        let current_heading_level = 0;
        for(let i =0; i < mainChildren.length; i++){
            const node = mainChildren[i];
            if(node.nodeType === ELEMENT_NODE){
                const element_name = node.nodeName;
                if(/^[Hh][1-6]$/.test(element_name)){
                    current_heading_level = Number(element_name.substring(1,2));
                }
            } else if(node.nodeType === COMMENT_NODE){
                const comment_data = node.data.trim();
                if(comment_data.indexOf(COMMENT_PREFIX) < 0) continue;
                const comment_id = comment_data.replace(COMMENT_PREFIX, '').trim();
                console.log(`[Debug]: ${comment_id} / heading:${current_heading_level}`);
            }
        }
        fs.writeFileSync(dest_file_path, dom.serialize());
    });
});


