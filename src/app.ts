import express from "express";
import cors from "cors";
import authRouter from "./routes/auhRoutes/auth.routes";
import { globalLimiter } from "./middlewares/ratelimiter";

const app = express();


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set("trust proxy", 1);
app.use(globalLimiter);


// api routes

// ----------------------------------auth routes--------------------------------
app.use("/api/v1/auth",authRouter);













export default app;