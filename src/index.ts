import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import {
  Network,
  paymentMiddleware,
  Resource,
  type SolanaAddress,
} from "x402-express";
// import { coinbase } from "facilitators";
import { z } from "zod";
import {
  inputSchemaToX402GET,
  inputSchemaToX402POST,
  zodToJsonSchema,
} from "./lib/schema";
import type { PaymentMiddlewareConfig } from "x402/types";

config();

const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
const payTo = process.env.ADDRESS as `0x${string}` | SolanaAddress;
const network = process.env.NETWORK as Network;

if (!payTo || !network || !facilitatorUrl) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputSchema = z.object({
  fen: z.string().describe("FEN of the current chess position"),
  depth: z.string().min(1).max(2).default("10").describe("depth (1-12), optional, default 10"),
});

// --- Shared primitives
const CountryISO2 = z
  .string()
  .regex(/^[A-Z]{2}$/, "Use ISO-3166-1 alpha-2 (e.g. US, BE)");

export const AddressTo = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.email(),
  phone: z.string().min(3).max(32).optional().or(z.literal("")).optional(), // Printify tolerates many formats
  country: CountryISO2,
  region: z.string().optional().default(""),
  address1: z.string().min(1),
  address2: z.string().optional().default(""),
  city: z.string().min(1),
  zip: z.string().min(1),
});

export const CreateShirtBody = z.object({
  prompt: z.string().min(10, "Prompt too short").max(4000, "Prompt too long"),
  size: z.enum(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]).default("XL"),
  color: z.enum(["Black", "White"]).default("White"),
  address_to: AddressTo,
});

// Validate the response data with zod
const responseSchema = z.object({
  success: z.literal(true),
  evaluation: z.number(),
  bestmove: z.string(),
  mate: z.number().nullable(),
});

console.log(inputSchemaToX402GET(CreateShirtBody));
console.log(inputSchemaToX402POST(CreateShirtBody));
console.log(inputSchemaToX402POST(inputSchema));
console.log(inputSchemaToX402GET(inputSchema));
console.log(zodToJsonSchema(responseSchema));

const app = express();


// Testing various schemas
app.use(
  paymentMiddleware(
    payTo,
    {
      "GET /best-move": {
        price: "$0.001",
        network,
        config: {
          discoverable: true, // make your endpoint discoverable
          description: "Get stockfish analysis for a given FEN",
          inputSchema: inputSchemaToX402GET(inputSchema),
          outputSchema: zodToJsonSchema(responseSchema),
        },
      },
    },
    {
      url: facilitatorUrl,
    },
  ),
);

// Serve static files from public directory
// __dirname points to dist/, so we need to go up one level to reach the project root
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/weather", (req, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

async function getBestMove(fen: string, depth: number) {
  const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${depth}`;
  console.log(`[/best-move] Fetching: ${url}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `[/best-move] API Error - Status: ${response.status} ${response.statusText}`,
      );
      throw new Error(`Stockfish API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[/best-move] Raw API Response:`, JSON.stringify(data, null, 2));

    const validatedData = responseSchema.parse(data);
    console.log(`[/best-move] Validation successful`);

    return validatedData;
  } catch (error) {
    console.error(`[/best-move] Error in getBestMove:`, error);
    throw error;
  }
}

app.get("/best-move", async (req, res) => {
  try {
    const { success, data } = inputSchema.safeParse(req.query);
    if (!success) {
      return res.status(400).json({
        error: "Invalid request parameters, " + JSON.stringify(req.query),
      });
    }
    const { fen, depth } = data;
    const depthNumber = parseInt(depth);
    if (isNaN(depthNumber) || depthNumber < 1 || depthNumber > 12) {
      return res.status(400).json({
        error: "Invalid depth, must be a number between 1 and 12, got " + depth,
      });
    }
    const response = await getBestMove(fen, depthNumber);
    return res.json(response);
  } catch (error) {
    console.error("[/best-move] Error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
});

app.get("/premium/content", (req, res) => {
  res.send({
    content: "This is premium content",
  });
});

// Home route - HTML
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
        <h1>♟️ Chess Best Move x402 API</h1>
        <div class="status">
          <p><strong>Status:</strong> healthy ✓</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
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

// Example API endpoint - JSON
app.get("/api-data", (req, res) => {
  res.json({
    message: "Here is some sample API data",
    items: ["apple", "banana", "cherry"],
  });
});

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:4021`);
});
