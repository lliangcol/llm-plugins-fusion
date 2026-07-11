export function parseMigrationArgs(args) {
  let dryRun = false;
  let help = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return { dryRun, help };
}
