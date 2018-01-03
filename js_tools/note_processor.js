const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom; // JSDOM = jsdom.JSDOM;

// 訳注パーサの定数
const COMMENT_NODE = 8; // nodeType
const ELEMENT_NODE = 1; // nodeType
const COMMENT_PREFIX = 'translator_notes:';
const NOTE_PREFIX = '訳注:';
const NOTE_KEY = 'note';
const REFERENCE_PREFIX = '参考:';
const REFERENCE_KEY = 'reference';
const DEFAULT_KEY = 'default';
const ALL_KEY = 'all';

const note_id_finder = /<分節\s*([0-9]+)\s*>/;
const url_finder = /^https?:\/\//;

// ターゲットディレクトリ
const source_note_dir = '../translator_notes/';
const source_html_dir = '../source/';
const dest_dir = './temp/';

// 訳注データをパースしてオブジェクトに格納する
// note_data[(訳注番号)].note / note_data[(訳注番号)].reference で取り出せるようにする
console.log('訳注ファイルのロードを開始します...')
let note_data = {};
const text_files = fs.readdirSync(source_note_dir).filter(file => { return /\.txt$/.test(file);});
text_files.forEach(file => {
    const source_file_path = source_note_dir + file;
    const text = fs.readFileSync(source_file_path, 'utf8');
    const lines = text.split("\n");
    console.log(file);

    // 文節番号をIDとする。分節番号を発見したらここに格納する
    let current_id = '';

    // 訳注は、原文引用部 / 訳注部 / 参考部からなる。
    // 「訳注:」「参考:」を発見したら以降をそのパートとみなし、格納対象キー名をこの変数に格納する
    let current_key = DEFAULT_KEY;
    let current_reference_index = -1;
    lines.forEach((line, index) => {
        line = line.trim();
        let m = line.match(note_id_finder);
        if(m){
            // 分節番号を発見したので以降その分節の訳注とみなす
            current_id = m[1];
            note_data[current_id] = {};
            current_key = DEFAULT_KEY; 
        } else if(current_id){
            // 分節番号発見済み
            // if(line.startsWith('>')) return; // 原文の引用はスルー → 初期モード '' なので冒頭の引用はスルーされる
            if(line.startsWith(NOTE_PREFIX)){
                // 訳注: を発見したので以降を訳注とする
                current_key = NOTE_KEY;
                note_data[current_id][NOTE_KEY] = '';
            } else if(line.startsWith(REFERENCE_PREFIX)){
                // 参考: を発見したので以降を参考とする
                current_key = REFERENCE_KEY;
                current_reference_index = -1;
                note_data[current_id][REFERENCE_KEY] = [];
            } else {
                // パーツ格納、訳注でも参考でもないものは default に格納
                if(current_key === REFERENCE_KEY){
                    // URLかどうか判定、URLでなければキーとして扱う
                    if(line){
                        if(!line.match(url_finder)){
                            current_reference_index++;
                            note_data[current_id][REFERENCE_KEY][current_reference_index] = {'key': line};
                        } else {
                            note_data[current_id][REFERENCE_KEY][current_reference_index].url = line;
                        }
                    }
                } else {
                    note_data[current_id][current_key] += line + "\n";
                }
                // 訳注テキスト全体もとりだせるようにしておく
                note_data[current_id][ALL_KEY] += line + "\n";
            }
        }
    });
});
console.log(`${Object.keys(note_data).length} 件の訳注を読み込みました。`);



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
console.log('訳注の挿入処理を開始します。');
const html_files = fs.readdirSync(source_html_dir).filter(file => { return /\.html$/.test(file);});
html_files.forEach(file => {
    const source_file_path = source_html_dir + file;
    const dest_file_path = dest_dir + file;
    JSDOM.fromFile(source_file_path).then(dom => {
        console.log(file);
        const document = dom.window.document;
        console.log("title: " + document.getElementsByTagName('title')[0].childNodes[0].data);

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

                const note = note_data[comment_id];
                if(!note){
                    console.log(`note ${comment_id} not found.`);
                }

                const note_text = note_data[comment_id][NOTE_KEY];
                if(note_text){
                    const note_lines = note_text.trim().split('\n');

                    const note_element = document.createElement('div');
                    note_element.setAttribute('class', 'translator_note');
                    note_element.setAttribute('id','translator_note' + comment_id);

                    const note_heading = document.createElement('h' + (current_heading_level + 1));
                    note_heading.appendChild(document.createTextNode('訳註'));
                    note_element.appendChild(note_heading);

                    // 訳注テキストを処理
                    // ````～```` までの記述はコードブロックとする
                    // コードブロックモードで使用するpreを複数行で参照できるように外で持っておく
                    // これはフラグも兼ねる (code_block_preにHtmlElementが入っていればコードブロックモード)
                    let code_block_pre = undefined;
                    note_lines.forEach((line)=>{
                        if(code_block_pre){
                            // コードブロックモードでは既存のpreに追記する
                            // ```` を検出したらコードブロックモードを終了する
                            if(line.startsWith('````')){
                                code_block_pre = undefined;
                                return;
                            } else {
                                code_block_pre.appendChild(document.createTextNode(line + '\n'));
                            }
                        } else {
                            // ```` を検出したらコードブロックモードに移行する
                            if(line.startsWith('````')){
                                const pre_type = line.replace('````', '') || 'general';
                                code_block_pre = document.createElement('pre');
                                code_block_pre.setAttribute('class', pre_type);
                                note_element.appendChild(code_block_pre);
                            } else {
                                const note_p = document.createElement('p');
                                note_p.appendChild(document.createTextNode(line));
                                note_element.appendChild(note_p);
                            }
                        }
                    });

                    node.parentNode.replaceChild(note_element, node);
                    
                    // 参考
                    const references = note_data[comment_id][REFERENCE_KEY];
                    if(references){
                        const ref_heading = document.createElement('h' + (current_heading_level + 2));
                        ref_heading.appendChild(document.createTextNode('参考'));
                        note_element.appendChild(ref_heading);
                        const ref_ul = document.createElement('ul');
                        note_element.appendChild(ref_ul);
                        references.forEach((ref_obj)=>{
                            const ref_li = document.createElement('li');
                            const ref_a = document.createElement('a');
                            ref_a.setAttribute('href', ref_obj.url);
                            ref_a.appendChild(document.createTextNode(ref_obj.key));
                            ref_li.appendChild(ref_a);
                            ref_ul.appendChild(ref_li);
                        })
                    }
                    console.log(`note inserted: ${comment_id} in ${file}`);
                } else {
                    console.log(`note text not found: ${comment_id} in ${file}`);
                    console.log(note_data[comment_id][ALL_KEY]);
                }

            }
        }
        fs.writeFileSync(dest_file_path, dom.serialize());
    });
});

