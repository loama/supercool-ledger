import { expect, test } from 'bun:test';

test('keeps every documented evidence file resolvable', async () => {
  const readme = await Bun.file('README.md').text();
  const paths = [...readme.matchAll(/`((?:docs|migrations|src|test)\/[A-Za-z0-9_./-]+)`/g)]
    .flatMap((match) => (match[1] ? [match[1]] : []))
    .filter((path) => !path.endsWith('/'));
  expect(paths.length).toBeGreaterThan(10);
  for (const path of paths) {
    expect(await Bun.file(path).exists()).toBe(true);
  }
});

test('publishes the required reviewer evidence sections', async () => {
  const readme = await Bun.file('README.md').text();
  for (const heading of [
    'Financial invariants',
    'Transfer path',
    'Verification',
    'Observability',
    'Deployment',
    'Deliberate exclusions',
  ]) {
    expect(readme).toContain(`## ${heading}`);
  }
});
