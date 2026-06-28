/** @type {import('next').NextConfig} */
const nextConfig = {
  // The agent writes pngs into .autoqa constantly; don't let Next choke on them.
  outputFileTracingExcludes: { "*": ["./.autoqa/**", "./spike/**"] },
  // Critical: the agent clones repos + writes screenshots into .autoqa during a run.
  // Without ignoring it, the dev file-watcher storms and the cockpit freezes mid-run.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.autoqa/**", "**/spike/**"],
    };
    return config;
  },
};
export default nextConfig;
