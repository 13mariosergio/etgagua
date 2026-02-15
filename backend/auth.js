const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { getDB } = require("./db-postgres.js");

const JWT_SECRET = process.env.JWT_SECRET || "ETGAGUA_DEV_SECRET_CHANGE_ME";

function signToken(user) {
  return jwt.sign(
    { 
      sub: user.id, 
      username: user.username,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ error: "Sem token (Bearer)" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    const db = getDB();
    const result = await db.query(
      'SELECT id, username, role FROM public.users WHERE id = $1',
      [payload.sub]
    );
    
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Sem permissão" });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };