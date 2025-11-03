// src/index.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { paymentMiddleware } from "x402-express";
import { coinbase } from "facilitators";
import { z as z2 } from "zod";

// src/lib/schema.ts
import * as z from "zod";
function inputSchemaToX402(inputSchema2) {
  const jsonSchema = z.toJSONSchema(inputSchema2);
  const queryParams = {};
  if (jsonSchema.properties) {
    for (const [key, value] of Object.entries(jsonSchema.properties)) {
      if (typeof value === "object" && value !== null) {
        const prop = value;
        const type = prop.type || "string";
        const description = prop.description || "";
        queryParams[key] = description || `${type} parameter`;
      }
    }
  }
  return {
    type: "http",
    method: "GET",
    queryParams
  };
}
function zodToJsonSchema(schema) {
  return z.toJSONSchema(schema);
}

// src/index.ts
config();
var facilitatorUrl = process.env.FACILITATOR_URL;
var payTo = process.env.ADDRESS;
var network = process.env.NETWORK;
if (!payTo || !network || !facilitatorUrl) {
  console.error("Missing required environment variables");
  process.exit(1);
}
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var inputSchema = z2.object({
  fen: z2.string(),
  depth: z2.number().optional().default(10)
});
var responseSchema = z2.object({
  success: z2.literal(true),
  evaluation: z2.number(),
  bestmove: z2.string(),
  mate: z2.number().nullable()
});
var app = express();
app.use(
  paymentMiddleware(
    payTo,
    {
      "/best-move": {
        price: "$0.001",
        network,
        config: {
          discoverable: true,
          // make your endpoint discoverable
          description: "Get stockfish analysis for a given FEN",
          inputSchema: inputSchemaToX402(inputSchema),
          outputSchema: zodToJsonSchema(responseSchema)
        }
      }
    },
    coinbase
  )
);
app.get("/weather", (req, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70
    }
  });
});
async function getBestMove(fen, depth) {
  const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${depth}`;
  console.log(`[/best-move] Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`[/best-move] API Error - Status: ${response.status} ${response.statusText}`);
    return {
      success: false,
      error: `Stockfish API returned ${response.status}: ${response.statusText}`
    };
  }
  const data = await response.json();
  console.log(`[/best-move] Raw API Response:`, JSON.stringify(data, null, 2));
  const validatedData = responseSchema.parse(data);
  console.log(`[/best-move] Validation successful`);
  return validatedData;
}
app.get("/best-move", async (req, res) => {
  const { success, data } = inputSchema.safeParse(req.query);
  if (!success) {
    return res.status(400).json({ error: "Invalid request parameters" });
  }
  const { fen, depth } = data;
  const response = await getBestMove(fen, depth);
  res.send(response);
});
app.get("/premium/content", (req, res) => {
  res.send({
    content: "This is premium content"
  });
});
app.get("/", (req, res) => {
  const protocol = req.protocol;
  const host = req.get("host");
  res.type("html").send(`
 <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chess Best Move x402 API</title>
        <link rel="icon" href="/favicon.ico" type="image/x-icon">
        <meta property="og:title" content="Chess Best Move x402 API" />
        <meta property="og:description" content="Get Stockfish chess analysis for any position - Monetized with x402" />
        <meta property="og:image" content="${protocol}://${host}/og-image.png" />
        <meta property="og:url" content="${protocol}://${host}" />
        <meta name="twitter:card" content="summary_large_image" />
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          h1 { color: #1a1a1a; }
          .status { 
            background: #e8f5e9; 
            padding: 15px; 
            border-radius: 8px;
            margin: 20px 0;
          }
          .endpoint {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
          }
          code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
          }
          a { color: #1976d2; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>\u265F\uFE0F Chess Best Move x402 API</h1>
        <div class="status">
          <p><strong>Status:</strong> healthy \u2713</p>
          <p><strong>Timestamp:</strong> ${(/* @__PURE__ */ new Date()).toISOString()}</p>
          <p><strong>Uptime:</strong> ${Math.floor(process.uptime())}s</p>
          <p><strong>Version:</strong> ${process.version}</p>
        </div>

        <h2>About</h2>
        <p>This API provides Stockfish chess engine analysis for any chess position using FEN notation. Each request costs $0.001 and is powered by the x402 payment protocol.</p>

        <h2>API Endpoint</h2>
        <div class="endpoint">
          GET /best-move?fen=&lt;FEN_STRING&gt;&depth=&lt;DEPTH&gt;
        </div>

        <h3>Parameters</h3>
        <ul>
          <li><code>fen</code> (required): FEN string representing the chess position</li>
          <li><code>depth</code> (optional): Analysis depth (1-30, default: 10)</li>
        </ul>

        <h3>Example</h3>
        <div class="endpoint">
          ${protocol}://${host}/best-move?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&depth=15
        </div>

        <h2>Resources</h2>
        <p>
          If you made it here, you are probably developing an x402 app. 
          Here are the <a href="https://echo.merit.systems/docs" target="_blank">Docs</a>.
        </p>
        <p>
          DM me on Discord at <strong>@.masonhall</strong> with the keyword "The white rabbit told me to say 'Echo'" and I'll send you some free credits.
        </p>
      </body>
    </html>
  `);
});
app.use("/favicon.ico", express.static(path.join(__dirname, "public", "favicon.ico")));
app.use("/og-image.png", express.static(path.join(__dirname, "public", "og-image.png")));
app.get("/api-data", (req, res) => {
  res.json({
    message: "Here is some sample API data",
    items: ["apple", "banana", "cherry"]
  });
});
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.listen(4021, () => {
  console.log(`Server listening at http://localhost:4021`);
});
