// auto-qa agent CLI.  Usage: npm run agent -- <command> [args]
const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "onboard": {
    const { onboardMain } = await import("./onboard.mjs");
    await onboardMain(rest[0]);
    break;
  }
  case "review": {
    const { reviewPR } = await import("./review.mjs");
    await reviewPR(rest[0] || "pr-1");
    break;
  }
  default:
    console.log("usage: npm run agent -- onboard [targetDir]\n       npm run agent -- review <pr-id>");
}
