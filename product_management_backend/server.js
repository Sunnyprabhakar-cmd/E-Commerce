import express from "express";
import routes from "./routes/routes.js";
import { ensureProductSchema } from "./product_model/model.js";
import cors from "cors";
const app=express();
app.use(cors({
  origin: ["http://localhost:5173","http://localhost:5174"]
}));
app.use(express.json());
app.use(routes);
const port=3000;

const startServer = async () => {
  try {
    await ensureProductSchema();
    app.listen(port,()=>{
        console.log(`running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
};

startServer();
