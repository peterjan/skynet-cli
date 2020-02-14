import fs from 'fs-extra';
export type SkipFunc = (entry: fs.Dirent) => boolean
export type Map = { [path: string]: string }