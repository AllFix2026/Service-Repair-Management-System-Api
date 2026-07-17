import httpLoggerMiddleware from "@/middlewares/httpLogger.middleware";
import { notFoundMiddleware } from "@/middlewares/notFound.middleware";
import router from "@/routes/index";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { Application, Request, Response } from "express";
import helmet from "helmet";

const app: Application = express();

// set security HTTP headers

app.use(
  express.json({
    limit: "5mb",
    verify: (req: any, _res, buf) => {
      if (req.originalUrl.includes("/webhook")) {
        req.rawBody = buf;
      }
    },
  }),
);

// parse urlencoded request body
app.use(
  express.urlencoded({
    extended: true,
    parameterLimit: 100000,
    limit: "5mb",
  }),
);
app.use(cookieParser());
app.use(httpLoggerMiddleware);
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? [],
  credentials: true,
}));
app.use(compression({ threshold: 2048 }));
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}


app.use("/api", router);
app.use("/v1/api", router);
// 404 then error handler (must be last)
app.use(notFoundMiddleware);

export default app;