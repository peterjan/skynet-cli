import axios from "axios";
import FormData from 'form-data';
import fs from 'fs-extra';
import path from 'path';
import { Map, SkipFunc } from './types';

require('dotenv').config();

export function recListFiles(dir: string, skip: SkipFunc): string[] {
    let files: string[] = []
    let contents = fs.readdirSync(dir, { withFileTypes: true }).filter(skip)
    for (const c of contents) {
        if (c.isDirectory()) {
            files = files.concat(recListFiles(path.join(dir, c.name), skip))
            continue;
        }
        files.push(path.join(dir, c.name))
    }
    return files
}


export function recBuildDirHTML(dir: string, skip: SkipFunc, skylinks: Map) {
    let html = ''
    let contents = fs.readdirSync(dir, { withFileTypes: true }).filter(skip)
    for (const c of contents) {
        const fullpath = path.join(dir, c.name)
        if (c.isDirectory()) {
            html += '<li role="treeitem" aria-expanded="false">';
            html += `<span>${c.name}</span>`;
            html += '<ul role="group">'
            html += recBuildDirHTML(fullpath, skip, skylinks);
            html += "</ul>"
            html += '</li>';
            continue;
        }
        html += '<li role="treeitem" class="doc">'
        html += `<a href="sia://${skylinks[fullpath]}">${path.basename(fullpath)}</a>`
        html += '</li>'
    }
    return html
}

const cset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export async function upload(portal: string, file: string): Promise<string | Error> {
    if (process.env.MOCK_UPLOADS) {
        // return random skylink
        let skylink = '';
        for (var i = 0; i < 64; i++) {
            skylink += cset.charAt(Math.floor(Math.random() * cset.length));
        }
        return skylink;
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(file));

    try {
        const resp = await axios.post(`${portal}api/skyfile?filename=${path.basename(file)}`, formData, {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
        })
        return resp.data['skylink']
    } catch (err) {
        return new Error(`Upload failed, ${err}`)
    }
}


export async function uploadMultiple(portal: string, files: string[]): Promise<Map | Error> {
    const skylinks: Map = {}
    const promises = []
    for (const file of files) {
        promises.push(new Promise((resolve, reject) => {
            upload(portal, file).then((skylink) => {
                if (process.env.DEBUG) {
                    console.log(`Done ${path.basename(file)}`);
                } else {
                    process.stdout.write(".");
                }
                if (skylink instanceof Error) {
                    reject(skylink.message)
                } else {
                    skylinks[file] = skylink
                    resolve();
                }
            }).catch(() => {
                reject(`Could not upload file ${file}`)
            })
        }))
    }
    await Promise.all(promises).catch(err => {
        return new Error(err)
    })
    console.log();
    return skylinks
}

export function trimTrailingSlash(str: string) {
    if (str.substr(-1) === '/') {
        return str.substr(0, str.length - 1);
    }
    return str;
}