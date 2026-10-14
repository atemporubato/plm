const http = require("http"), fs = require("fs"), path = require("path");
const handler = require("./api/shopify.js");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
http.createServer((req, res) => {
  if (req.url.startsWith("/api/shopify")) {
    let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
      req.body = body; res.status = (c) => { res.statusCode = c; return res; }; res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
      handler(req, res);
    }); return;
  }
  const p = path.join(__dirname, "web", req.url.split("?")[0] === "/" ? "index.html" : req.url.split("?")[0]);
  fs.readFile(p, (e, d) => { if (e) { res.statusCode = 404; res.end("nope"); return; } res.setHeader("Content-Type", types[path.extname(p)] || "application/octet-stream"); res.end(d); });
}).listen(3000, () => console.log("dev på 3000"));
