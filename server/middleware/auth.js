const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 👇 OVDE "lepimo" user na request
    req.user = decoded; // { id, email }

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  module.exports = function auth(req, res, next) {
  console.log("🔐 AUTH MIDDLEWARE");

  const header = req.headers.authorization;
  console.log("📛 AUTH HEADER:", header);

  if (!header) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ TOKEN VALID:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ TOKEN INVALID:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

};
