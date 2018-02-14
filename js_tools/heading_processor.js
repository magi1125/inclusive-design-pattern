const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom; // JSDOM = jsdom.JSDOM;

const { parse } = require('parse5');
const { serializeToString } = require('xmlserializer');
const xmlHeader = '<?xml version=\'1.0\' encoding=\'UTF-8\' ?>\n';

function html2xhtml(htmlString) {
    const dom = parse(htmlString);
    return xmlHeader + serializeToString(dom);
}

// ターゲットディレクトリ
const source_html_dir = '../epub/OPS/';
const dest_dir = './result/';

// 出力ディレクトリがなければ作る
fs.access(dest_dir, fs.constants.R_OK | fs.constants.W_OK, (error) => {
    if (error) {
      if (error.code === "ENOENT") {
        fs.mkdirSync(dest_dir);
        console.log(`ディレクトリ ${dest_dir} を作成しました。`);
    } else {
        return;
      }
    }
});

// Process
let toc = '';
const html_files = fs.readdirSync(source_html_dir).filter(file => { return /\.xhtml$/.test(file);});
html_files.forEach(file => {
    const source_file_path = source_html_dir + file;
    const dest_file_path = dest_dir + file;
    JSDOM.fromFile(source_file_path).then(dom => {
        console.log(file);
        const document = dom.window.document;
        const mainDiv = document.body.childNodes[0];
        const mainChildren = mainDiv.childNodes;
        
        const h2_elements = document.getElementsByTagName('h2');
        let replaced_counter = 0;
        for(let i = 0; i < h2_elements.length; i++){
            const id_value = `section${i+1}`;
            const target_h2 = h2_elements[i];
            target_h2.setAttribute('id', id_value);
            console.log(`<a href="${file}#${id_value}">${target_h2.childNodes[0].data}</a>`);
            replaced_counter++;
        }
        if(replaced_counter){
            fs.writeFileSync(dest_file_path, html2xhtml(dom.serialize()));
            console.log(`${note_inserted_counter} 件の訳注を挿入し、保存しました: ${dest_file_path}`);
        }
    });
})

