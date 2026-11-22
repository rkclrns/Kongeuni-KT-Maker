const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function registryJavaHomes() {
  if (process.platform !== 'win32') return [];
  return [
    'HKCU\\Environment',
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
  ].flatMap(key => {
    try {
      const output = execFileSync('reg.exe', ['query', key, '/v', 'JAVA_HOME'], {
        encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore']
      });
      const value = output.match(/JAVA_HOME\s+REG_(?:EXPAND_)?SZ\s+(.+)/i)?.[1]?.trim();
      return value ? [value] : [];
    } catch { return []; }
  });
}

function subdirectories(root) {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() || entry.isSymbolicLink())
      .map(entry => path.join(root, entry.name)).sort();
  } catch { return []; }
}

function selectJava({ env = process.env, home = os.homedir(), readRegistry = registryJavaHomes } = {}) {
  const programFiles = env.ProgramFiles || 'C:\\Program Files';
  const roots = ['Java', 'Eclipse Adoptium', 'Microsoft', 'Amazon Corretto']
    .map(name => path.join(programFiles, name));
  const expand = value => typeof value === 'string'
    ? value.replace(/%([^%]+)%/g, (match, name) => env[name] || match).replace(/^"|"$/g, '').trim()
    : '';
  const candidates = [
    env.JAVA_HOME,
    ...readRegistry(),
    ...subdirectories(path.join(home, '.jdks')),
    ...roots.flatMap(subdirectories),
    path.join(programFiles, 'Android', 'Android Studio', 'jbr')
  ].map(expand).filter(Boolean);
  for (const candidate of new Set(candidates)) {
    try {
      const release = fs.readFileSync(path.join(candidate, 'release'), 'utf8');
      if (/JAVA_VERSION="21(?:[."])/.test(release) &&
          ['java.exe', 'javac.exe'].every(name => fs.existsSync(path.join(candidate, 'bin', name)))) {
        return candidate;
      }
    } catch { /* Try the next installed JDK. */ }
  }
  throw new Error('JDK 21�� ã�� ���߽��ϴ�. JDK 21�� ��ġ�ϰų� JAVA_HOME�� JDK 21 ��ġ ������ �������ּ���. ��ġ�� �ٸ� Java ������ �״�� �μŵ� �˴ϴ�.');
}

module.exports = { selectJava };
