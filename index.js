import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("aiTapTap backend running ✅");
});

app.listen(3000, () => console.log("Server running"));
