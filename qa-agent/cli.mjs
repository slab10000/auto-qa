// auto-qa agent CLI.  Usage: npm run agent -- <command> [args]
const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "onboard": {
    const { onboardMain } = await import("./onboard.mjs");
    await onboardMain({ repo: rest[0] });
    break;
  }
  case "review": {
    const { reviewPR } = await import("./review.mjs");
    await reviewPR(rest[0] || "1");
    break;
  }
  case "merge": {
    const { mergePR } = await import("./merge.mjs");
    await mergePR(rest[0] || "pr-1");
    break;
  }
  default:
    console.log(
      "usage: npm run agent -- onboard [owner/name]\n" +
        "       npm run agent -- review <pr-number>\n" +
        "       npm run agent -- merge <pr-id>"
    );
}
