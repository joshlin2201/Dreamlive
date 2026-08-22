import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const minimumMajor = 15;
const checkOnly = process.argv.includes('--check');
const files = {
  project: new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url),
  package: new URL('../ios/App/CapApp-SPM/Package.swift', import.meta.url),
};

const projectSource = await readFile(files.project, 'utf8');
const packageSource = await readFile(files.package, 'utf8');
const projectTargets = [...projectSource.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = (\d+(?:\.\d+)?);/g)];
const packageTarget = packageSource.match(/platforms: \[\.iOS\(\.v(\d+)\)\]/);

if (projectTargets.length === 0 || !packageTarget) {
  throw new Error('Could not find every iOS deployment-target declaration.');
}

const staleProjectTargets = projectTargets.filter((match) => Number(match[1]) < minimumMajor);
const stalePackageTarget = Number(packageTarget[1]) < minimumMajor;

if (checkOnly) {
  if (staleProjectTargets.length || stalePackageTarget) {
    throw new Error(`iOS deployment target must be ${minimumMajor}.0 or newer.`);
  }
  console.log(`PASS iOS deployment target is ${minimumMajor}.0 or newer.`);
  process.exit(0);
}

const nextProjectSource = projectSource.replace(
  /IPHONEOS_DEPLOYMENT_TARGET = (\d+(?:\.\d+)?);/g,
  (declaration, version) => Number(version) < minimumMajor
    ? `IPHONEOS_DEPLOYMENT_TARGET = ${minimumMajor}.0;`
    : declaration,
);
const nextPackageSource = stalePackageTarget
  ? packageSource.replace(/platforms: \[\.iOS\(\.v\d+\)\]/, `platforms: [.iOS(.v${minimumMajor})]`)
  : packageSource;

await Promise.all([
  writeFile(files.project, nextProjectSource),
  writeFile(files.package, nextPackageSource),
]);

console.log(`Enforced iOS ${minimumMajor}.0 minimum deployment target.`);
