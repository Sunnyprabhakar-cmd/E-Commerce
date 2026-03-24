import express from "express";
import routes from "./routes/routes.js";
import { loadProducts } from "./utils/storage.js";
import cors from "cors";
const app=express();
app.use(cors({
  origin: ["http://localhost:5173","http://localhost:5174"]
}));
app.use(express.json());
loadProducts();
app.use(routes);
const port=3000;
app.listen(port,()=>{
    console.log(`running on port ${port}`);
});
