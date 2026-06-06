export const REQUIRED_NODE_MAJOR = 20;

export function nodeMajorVersion(version = process.versions.node) {
  const major = Number.parseInt(String(version).split('.')[0], 10);
  return Number.isFinite(major) ? major : null;
}

export function assertNodeVersion(options = {}) {
  const {
    label = 'repository validators',
    exit = true,
  } = options;
  const major = nodeMajorVersion();
  const ok = major !== null && major >= REQUIRED_NODE_MAJOR;
  if (ok) return true;

  const message = [
    `ERROR ${label}: Node.js ${REQUIRED_NODE_MAJOR}+ is required.`,
    `Current Node.js: ${process.version}`,
  ].join('\n');

  if (exit) {
    console.error(message);
    process.exit(1);
  }

  return false;
}
