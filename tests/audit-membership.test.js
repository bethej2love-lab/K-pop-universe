const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),builder=fs.readFileSync(path.join(root,'build_group_pages.js'),'utf8');
const groups=JSON.parse(fs.readFileSync(path.join(root,'groups.json'),'utf8')),artists=JSON.parse(fs.readFileSync(path.join(root,'artists.json'),'utf8'));
const c={GROUPS:groups,ARTISTS:artists};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'shared.js'),'utf8'),c);
const extract=(src,name,indent='')=>{const a=src.indexOf('function '+name+'(');assert(a>=0,name);const b=src.indexOf('\n'+indent+'}',a);assert(b>a);return src.slice(a,b+indent.length+2);};
const gunwoo=artists.find(a=>a.id==='a0350');assert.equal(c._artistMembershipStatus(gunwoo,gunwoo.group.ko,groups[gunwoo.group.ko]),'paused');
assert.equal(c._artistMembershipStatus({...gunwoo,left:'2026.04.08'},gunwoo.group.ko,{}),'former');
const dual={group:{ko:'A'},active:false,left:'2020.01.01',joined:'2010.01.01',groups:[{ko:'A'},{ko:'B',active:true,joined:'2022.01.01'}]};
assert.equal(c._artistMembershipStatus(dual,'B',{}),'current');assert.equal(c._artistAffiliation(dual,'B').left,undefined);
assert.equal(c._artistAffiliation(dual,'A').joined,'2010.01.01');assert.equal(dual.groups[0].joined,undefined,'no source mutation');
assert.equal(c._joinedStartDate('2026'),'2026-01-01');assert.equal(c._joinedStartDate('2026.06'),'2026-06-01');assert.equal(c._joinedStartDate('2026.02.30'),null);
assert.equal(c._groupJoinOrDebut('2020.01.01','2020.05.19'),'2020.05.19','joining before formation is not an early debut');
c._groupEndDate=()=>null;c._groupIsOver=g=>!!groups[g]?.disbanded;
vm.runInContext(extract(app,'_memberVideoCutoff','  ')+'\n'+extract(app,'_memberVideoCutoffCore','  '),c);
for(const id of ['a1893','a1894','a1895','a1896']){const a=artists.find(a=>a.id===id);assert.equal(c._memberVideoCutoff(a.name.ko,a.group.ko).joined,'2025-08-14',id+' root join cutoff');}
assert.equal(c._memberVideoCutoff(gunwoo.name.ko,gunwoo.group.ko).left,'2026-04-08','paused inactive member keeps pre-hiatus group videos');
// Execute the actual graph input loop, without SVG rendering.
vm.runInContext(extract(app,'_mxAgeAt'),c);c.document={createElementNS(){}};
const graph=app.slice(app.indexOf('function _mxFigBuild('),app.indexOf("  const wrap=document.createElement('div');wrap.className='mx-fig';",app.indexOf('function _mxFigBuild(')))+'return pts;\n}';
vm.runInContext(graph,c);const pts=c._mxFigBuild();
for(const id of ['a1893','a1894','a1895','a1896']){const a=artists.find(a=>a.id===id),p=pts.find(p=>p.a.id===id);assert.ok(p);assert.equal(p.age,c._mxAgeAt(a.bday,'2025.08.14').age);}
// Timeline: capture generated events by returning its existing local ev array in the harness.
c.currentLang='ko';c.document={getElementById:()=>({style:{},querySelector:()=>null})};c._ensureMemberDisco=()=>Promise.resolve();c._ensureGroupDisco=()=>Promise.resolve();c._renderTimeline=()=>{};c._tlAttachDebutAlbum=()=>false;c._tlOpenAlbum=()=>{};c._openTArtist=null;c.sb=null;
c._tlKey=s=>String(s||'').replace(/\D/g,'').padEnd(8,'0');c._tlDate=s=>s;c._disbandCutoffDate=g=>groups[g].disbanded;
let timeline=extract(app,'_buildMemberTimeline');timeline=timeline.slice(0,-1)+'return ev;\n}';vm.runInContext(timeline,c);
const renta=artists.find(a=>a.id==='a1082');const events=c._buildMemberTimeline(renta);
assert.ok(events.some(e=>String(e.date).startsWith('2022.06')&&/합류/.test(e.label)));
assert.ok(events.some(e=>String(e.date).startsWith('2023.09')&&/탈퇴/.test(e.label)),'same-year earlier departure is not disbandment');
assert.ok(!events.some(e=>String(e.date).startsWith('2020')),'group founding is not a later member debut');
const pausedEvents=c._buildMemberTimeline(gunwoo);assert.ok(pausedEvents.some(e=>/활동 중단/.test(e.label)));assert.ok(!pausedEvents.some(e=>/탈퇴/.test(e.label)));
c.groups=groups;c.escHtml=String;c.agencyEn=s=>s;c.affiliationFor=c._artistAffiliation;c.membershipStatus=(a,g)=>c._artistMembershipStatus(a,g,groups[g]);
vm.runInContext(extract(builder,'groupIntroHtml')+'\n'+extract(builder,'memberIntroHtml'),c);
const members=artists.filter(a=>c._artistGroups(a).some(g=>g.ko==='시크릿넘버'));
assert.match(c.groupIntroHtml('시크릿넘버',groups['시크릿넘버'],members,[],'ko'),/4인조/);
assert.match(c.groupIntroHtml('시크릿넘버',groups['시크릿넘버'],members,[],'en'),/4-member/);
const am=artists.filter(a=>c._artistGroups(a).some(g=>g.ko==='알파드라이브원'));
assert.match(c.groupIntroHtml('알파드라이브원',groups['알파드라이브원'],am,[],'en'),/8-member/);
const secret=artists.filter(a=>c._artistGroups(a).some(g=>g.ko==='시크릿'));assert.match(c.groupIntroHtml('시크릿',groups['시크릿'],secret,[],'en'),/is a 3-member/);
c.ISO_COUNTRY={};assert.match(c.memberIntroHtml(gunwoo,[gunwoo.group],'ko'),/활동 중단/);assert.doesNotMatch(c.memberIntroHtml(gunwoo,[gunwoo.group],'en'),/former/);
console.log('✅ Joined dates across video/graph/timeline; hiatus vs departure; current vs historical membership');
