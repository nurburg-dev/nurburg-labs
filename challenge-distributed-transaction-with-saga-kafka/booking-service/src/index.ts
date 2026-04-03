import express from "express";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.get("/healthcheck", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`booking-service running on port ${PORT}`);
});
