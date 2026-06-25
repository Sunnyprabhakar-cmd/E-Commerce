import express from "express";
import routes from "./routes/routes.js";
import { ensureProductSchema } from "./product_model/model.js";
import { ensureAdminPortalSchema } from "./services/admin_portal.js";
import helmet from "helmet";
import { globallimiter } from "./middleware/middleware.js";
const app=express();
const allowedOrigins = new Set(["http://localhost:5173", "http://localhost:5174","https://e-commerce-two-pi-81.vercel.app"]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(globallimiter);
app.use(helmet());
app.use(express.json());
app.use(routes);
const port = Number(process.env.PORT) || 3001;

const startServer = async () => {
  try {
    await ensureProductSchema();
    await ensureAdminPortalSchema();
    app.listen(port,()=>{
        console.log(`running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();