#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';
import clear from 'clear';
import figlet from 'figlet';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import htmlTemplate from './tpl';
import { recBuildDirHTML, recListFiles, trimTrailingSlash, upload, uploadMultiple } from "./utils";

const log = console.log;

clear();
log(chalk.red(figlet.textSync('skycli', { horizontalLayout: 'full' })));

const init = async () => {
    var args = parseArgs(process.argv.slice(2));
    const directory: string = args.directory;
    const portal: string = args.portal;

    log(chalk.white('\nUploading contents of directory', chalk.red.bold(path.resolve(process.cwd(), directory)), 'to', chalk.red.bold(portal), '\n'))

    // list all files to upload
    const files = recListFiles(directory, skip)
    const numFiles = files.length
    log(chalk.white(`Found ${numFiles} files to upload`))

    // upload them in parallel and build a map of skylinks
    const skylinks = await uploadMultiple(portal, files)
    if (skylinks instanceof Error) {
        log(chalk.red(`Upload failed, error: ${skylinks.message}`))
        return
    }
    log(chalk.green(`Upload complete\n`))

    // build html
    log(chalk.white(`Building html`))
    let treeHtml = `<h3 id="tree_label">Contents of ${directory}</h3>`
    treeHtml += '<ul role="tree" aria-labelledby="tree_label">'
    treeHtml += recBuildDirHTML(directory, skip, skylinks)
    treeHtml += '</ul>'

    // upload html
    const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'skycli'))
    const tmploc = path.join(tmpdir, "directory.html")
    const html = htmlTemplate.replace("REPLACEME", treeHtml)
    fs.writeFileSync(tmploc, html)

    const skylink = await upload(portal, tmploc)
    fs.removeSync(tmploc)
    fs.rmdirSync(tmpdir)
    log(chalk.green(`Upload complete\n`))

    if (!skylink) {
        log(chalk.red(`Something went wrong... perhaps try a different portal\n`))
        process.exit(0)
    }

    log(chalk.white('You can find your files at\n'))
    log(chalk.red.bold(`${portal}${skylink}\n\n`))
}

const printUsage = () => {
    console.log(`
Usage: skycli upload [directory] [options]

Options:
-p, --portal      specify the skynet portal (defaults to https://siasky.net)
-h, --help        print this message
    `)
}

const parseArgs = (args: string[]): {
    portal: string;
    directory: string;
} => {
    if (args.length < 2) {
        printUsage()
        process.exit(0)
    }

    const out = defaults
    out['directory'] = args[1]
    for (let i = 2; i < args.length; i += 2) {
        switch (args[i]) {
            case '-p':
            case '--portal':
                out['portal'] = args[i + 1]
                break;
            case '-h':
            case '--help':
                printUsage()
                process.exit(0)
            default:
                console.log("ERROR: unknown option", args[i])
                printUsage()
                process.exit(0)
        }
    }

    out['portal'] = `${trimTrailingSlash(out['portal'])}/`

    // validate input
    if (!fs.existsSync(out['directory'])) {
        log(chalk.red(`\nFailed to find directory "${out['directory']}"`))
        process.exit(0)
    }
    const stat = fs.statSync(out['directory'])
    if (!stat.isDirectory()) {
        log(chalk.red(`\nThe given path is not a directory`))
        process.exit(0)
    }
    axios.get(out['portal']).then(resp => {
        if (resp.status != 200) {
            log(chalk.red(`\nFailed to reach portal at ${out['portal']}`))
            process.exit(0)
        }
    })

    return out
}

const defaults = {
    'portal': 'https://siasky.net/',
    'directory': '.',
};

// skip symbolic links and hidden files for now
const skip = (entry: fs.Dirent) => {
    return !entry.isSymbolicLink() && !entry.name.startsWith('.')
}

init()