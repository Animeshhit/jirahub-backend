import express from "express";
import cors from "cors";
import authRouter from "./routes/auhRoutes/auth.routes";
import { globalLimiter } from "./middlewares/ratelimiter";
import workspaceRouter from "./routes/workspaceRoutes/workspace.routes";

const app = express();


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.set("trust proxy", 1);
app.use(globalLimiter);


// api routes

// --------------------------------------health routes --------------------------------

app.get("/api/health",(req,res) => {
    res.status(200).json({
        status: "success",
        message: "API is healthy"
    })
})

// ----------------------------------auth routes--------------------------------
app.use("/api/v1/auth",authRouter);
// -------------------------------------workspace routes------------------------------
app.use("/api/v1/workspace",workspaceRouter);













export default app;