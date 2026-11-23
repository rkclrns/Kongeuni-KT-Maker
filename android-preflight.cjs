// Checks the Android build environment before the APK save dialog, and lists
// every missing piece at once instead of failing deep inside Gradle.
const fs = require('fs');
const path = require('path');
const { selectJava } = require('./java-runtime.cjs');

function sdkPath(env = process.env) {
  return env.ANDROID_HOME || env.ANDROID_SDK_ROOT || path.join(env.LOCALAPPDATA || '', 'Android', 'Sdk');
}

function check({ env = process.env, findJava = () => selectJava({ env }) } = {}) {
  const problems = [];
  let javaHome = null;
  try { javaHome = findJava(); } catch (error) { problems.push(`• ${error.message}`); }

  const sdk = sdkPath(env);
  if (!fs.existsSync(sdk)) {
    problems.push(`• Android SDK 폴더가 없습니다: ${sdk}\n  Android Studio를 설치하거나 ANDROID_HOME 환경 변수로 SDK 위치를 지정하세요.`);
  } else {
    if (!fs.existsSync(path.join(sdk, 'platforms', 'android-35', 'android.jar')))
      problems.push('• Android SDK Platform 35가 없습니다. Android Studio > SDK Manager > SDK Platforms에서 "Android 15 (API 35)"를 설치하세요.');
    if (!fs.existsSync(path.join(sdk, 'build-tools', '35.0.0')))
      problems.push('• Build Tools 35.0.0이 없습니다. SDK Manager > SDK Tools에서 "Show Package Details"를 켜고 35.0.0을 설치하세요.');
    if (!fs.existsSync(path.join(sdk, 'licenses')))
      problems.push('• Android SDK 라이선스 동의 기록이 없습니다. SDK Manager에서 패키지를 한 번 설치하면 함께 동의됩니다.');
  }

  if (problems.length) {
    throw new Error(`APK를 만들기 전에 아래 항목을 준비해주세요.\n\n${problems.join('\n')}\n\niOS 테마(.ktheme)는 이 준비 없이 바로 만들 수 있습니다.`);
  }
  return { sdk, javaHome };
}

module.exports = { check, sdkPath };
