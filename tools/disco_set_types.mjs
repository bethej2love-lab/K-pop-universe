#!/usr/bin/env node
// 출처로 확인한 앨범 종류·차수를 한꺼번에 반영(2026-11-03). disco_ordinal_audit.mjs의 "owner"(그룹 키 또는 "이름(그룹)")와 제목으로 찾는다.
// 사용: node tools/disco_set_types.mjs changes.json [--apply]   (⚠️ --apply 후 node tools/build_slim_data.mjs)
//   changes.json = [{ "owner": "ATBO", "title": "The Beginning : 開花", "type": "미니 1집", "src": "Wikipedia" }, ...]
//   선택: "region": "jp" 처럼 다른 칸도 같이 바꿀 수 있다(type 외 칸은 set 객체로: { "set": { "region": "jp" } }).
// 제목이 정확히 하나만 맞을 때만 바꾼다(0개·여러 개면 건너뛰고 알림). 들여쓰기는 원본에서 읽어 그대로 저장.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const APPLY = process.argv.includes('--apply');
const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const read = f => { const raw = fs.readFileSync(path.join(ROOT, f), 'utf8'); const ind = (raw.match(/\n( +)\S/) || [, '  '])[1].length; /* 첫 들여쓴 줄(배열 파일은 "{"로 시작) */ return { raw, ind, data: JSON.parse(raw) }; };
const G = read('groups.json'), A = read('artists.json');
const arts = Array.isArray(A.data) ? A.data : Object.values(A.data);
const discoOf = owner => {
  if (G.data[owner]) return G.data[owner].discography;
  const m = owner.match(/^(.+)\((.+)\)$/);
  const a = m && arts.find(x => x.name && x.name.ko === m[1] && (x.group && x.group.ko) === m[2]);
  return a && a.discography;
};
const norm = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
let ok = 0, skip = 0;
for (const c of list) {
  const d = discoOf(c.owner);
  const hits = (d || []).filter(a => norm(a.title) === norm(c.title) && (!c.date || String(a.releaseDate).startsWith(c.date)));
  if (hits.length !== 1) { skip++; console.log(`건너뜀(${hits.length}개 일치) ${c.owner} / ${c.title}`); continue; }
  const a = hits[0], before = a.type;
  if (c.type) a.type = c.type;
  if (c.set) Object.assign(a, c.set);
  ok++; console.log(`${c.owner} / ${c.title}: ${before} → ${a.type}${c.set ? ' ' + JSON.stringify(c.set) : ''}${c.src ? '  (' + c.src + ')' : ''}`);
}
console.log(`\n${ok}건 반영${APPLY ? '' : '(미리보기)'} · 건너뜀 ${skip}`);
if (APPLY) {
  // 바뀐 파일만, 원본 줄바꿈(CRLF/LF)·끝 개행 그대로 — 안 그러면 artists.json 30만 줄이 통째로 바뀐 것처럼 보인다
  for (const [f, X] of [['groups.json', G], ['artists.json', A]]) {
    const crlf = X.raw.includes('\r\n');
    let out = JSON.stringify(X.data, null, X.ind);
    if (crlf) out = out.replace(/\n/g, '\r\n');
    if (/\r?\n$/.test(X.raw)) out += crlf ? '\r\n' : '\n';
    if (out !== X.raw) fs.writeFileSync(path.join(ROOT, f), out);
  }
}
