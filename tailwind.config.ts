import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "dun": "#DBCFB0",
        "ash-gray": "#BFC8AD",
        "cambridge-blue": "#90B494",
        "slate-gray": "#718F94",
        "ultra-violet": "#545775",
      },
    },
  },
  plugins: [],
};
export default config;
