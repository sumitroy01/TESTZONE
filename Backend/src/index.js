import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import conDb from "./lib/db.js"; 
import userRoutes from "./routes/user.routes.js"
import cors from "cors";
import profileRouter from "./routes/profile.routes.js";
import donationRouter from "./routes/donations.js";
const app = express();

app.use(
  cors({
    origin: "https://donate-v2-jgkc.onrender.com",
    credentials: true,
  })
);

app.options("*", cors({
  origin: "https://donate-v2-jgkc.onrender.com",
  credentials: true,
}));



app.use(express.json());
app.use(cookieParser());
app.use("/api/user/",userRoutes);
app.use("/api/profile/",profileRouter);
app.use("/api/donations", donationRouter);
const PORT = process.env.PORT || 3000;
console.log("MONGO_URI is:", process.env.MONGO_URI);


const startServer = async () => {
  try {
    await conDb(); 
    app.listen(PORT, () => {
      console.log(`App running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
