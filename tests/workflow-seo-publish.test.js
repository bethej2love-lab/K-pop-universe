// 실제 workflow의 publish 구간을 임시 로컬 원격에서 실행. 외부 push/DB 조회 없음.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const {execFileSync, spawnSync} = require('child_process');
const yaml = fs.readFileSync(path.join(__dirname, '../.github/workflows/rebuild-seo-pages.yml'), 'utf8');
const start = yaml.indexOf('              git commit -m');
const end = yaml.indexOf('              echo "push 경합', start);
assert(start >= 0 && end > start, '실제 publish 구간 추출');
const script = yaml.slice(start, end);
const bash = process.platform === 'win32' ? execFileSync('where.exe', ['bash'], {encoding: 'utf8'}).trim().split(/\r?\n/)[0] : 'bash';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-seo-publish-'));
function git(dir, ...args) { return execFileSync('git', args, {cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim(); }
function write(dir, file, text) { fs.writeFileSync(path.join(dir, file), text); }
try {
  for (const scenario of ['unrelated', 'source', 'artifact']) {
    const root = path.join(tmp, scenario); fs.mkdirSync(root);
    const remote = path.join(root, 'remote.git'), build = path.join(root, 'build'), other = path.join(root, 'other');
    git(root, 'init', '--bare', '--initial-branch=main', remote);
    git(root, 'clone', remote, build);
    for (const dir of [build]) { git(dir, 'config', 'user.email', 'test@example.invalid'); git(dir, 'config', 'user.name', 'test'); }
    write(build, 'groups.json', '{}'); write(build, 'page.html', 'old'); write(build, 'notes.md', 'old');
    git(build, 'add', '.'); git(build, 'commit', '-m', 'base'); git(build, 'push', '-u', 'origin', 'main');
    git(root, 'clone', remote, other);
    git(other, 'config', 'user.email', 'test@example.invalid'); git(other, 'config', 'user.name', 'test');
    const changed = scenario === 'unrelated' ? 'notes.md' : scenario === 'source' ? 'groups.json' : 'page.html';
    write(other, changed, 'remote update'); git(other, 'add', '.'); git(other, 'commit', '-m', 'concurrent'); git(other, 'push');
    const remoteBefore = git(other, 'rev-parse', 'HEAD');
    write(build, 'page.html', 'built page'); git(build, 'add', 'page.html');
    const result = spawnSync(bash, ['-e', '-c', script], {cwd: build, encoding: 'utf8', env: {...process.env, GIT_TERMINAL_PROMPT: '0'}});
    assert.equal(result.status, 0, String(result.error || result.stderr));
    const remoteAfter = git(root, '--git-dir=' + remote, 'rev-parse', 'main');
    if (scenario === 'unrelated') {
      assert.notEqual(remoteAfter, remoteBefore, '문서 경합은 생성물을 재빌드 없이 게시');
      assert.equal(git(build, 'show', 'HEAD:notes.md'), 'remote update', '상대 문서 보존');
      assert.equal(git(build, 'show', 'HEAD:page.html'), 'built page');
    } else {
      assert.equal(remoteAfter, remoteBefore, '소스 변경/산출물 충돌은 낡은 결과를 게시하지 않음');
      assert.equal(fs.existsSync(path.join(build, '.git/rebase-merge')), false, 'rebase 충돌 정리');
    }
    console.log('PASS SEO publish: ' + scenario);
  }
} finally { fs.rmSync(tmp, {recursive: true, force: true}); }
