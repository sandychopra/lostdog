import index from "./index.html";

const server = Bun.serve({
  routes: {
    "/": index,
    "/*": index,
  },
  development: true,
});

console.log(`Frontend dev server running at ${server.url}`);
