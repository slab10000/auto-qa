/** @type {import('next').NextConfig} */
const nextConfig = {
  // The agent writes pngs into .autoqa constantly; don't let Next choke on them.
  outputFileTracingExcludes: { "*": ["./.autoqa/**", "./spike/**"] },
};
export default nextConfig;
