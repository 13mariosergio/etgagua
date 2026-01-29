# ⚡ Quick Start

## 🚀 Opção 1: Setup Automático (Linux/Mac)

```bash
./setup.sh
```

## 🖥️ Opção 2: Setup Manual

### Backend

```bash
cd backend
npm install
cp .env.example .env

# Edite o .env:
# HOST=0.0.0.0
# PORT=3333

npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env

# Edite o .env:
# VITE_API_URL=http://SEU_IP:3333

npm run dev
```

## 🌐 Acessar

- **Localhost**: http://localhost:5173
- **Outros dispositivos**: http://SEU_IP:5173

## 🔑 Login

```
Usuário: admin
Senha: admin123
```

## 📱 Configurar para Rede

1. **Descobrir IP da máquina:**
   ```bash
   # Linux/Mac
   ./get-ip.sh
   
   # Windows
   ./get-ip.ps1
   ```

2. **Configurar frontend/.env:**
   ```env
   VITE_API_URL=http://192.168.1.100:3333
   ```

3. **Liberar firewall (Windows):**
   ```powershell
   netsh advfirewall firewall add rule name="ETGAGUA Backend" dir=in action=allow protocol=TCP localport=3333
   netsh advfirewall firewall add rule name="ETGAGUA Frontend" dir=in action=allow protocol=TCP localport=5173
   ```

## ⚙️ Comandos Úteis

```bash
# Instalar tudo de uma vez
npm run install:all

# Rodar backend e frontend simultaneamente
npm run dev

# Build do frontend para produção
npm run build:frontend
```

## 🆘 Problemas?

Veja [DEPLOY.md](DEPLOY.md) para troubleshooting completo.
