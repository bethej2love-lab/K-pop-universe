// Diagnostic only: serve the pre-feature source in memory without changing the worktree.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const base=process.cwd(),files=new Map(['app.js','admin.js','kpop_universe.css'].map(f=>[path.resolve(base,f),cp.execFileSync('git',['show','a0953513abb:'+f],{maxBuffer:20e6})]));
const original=fs.readFile;
fs.readFile=function(file,...args){const hit=files.get(path.resolve(String(file)));if(!hit)return original.call(this,file,...args);const cb=args.at(-1),encoding=typeof args[0]==='string'?args[0]:args[0]?.encoding;queueMicrotask(()=>cb(null,encoding?hit.toString(encoding):hit));};
