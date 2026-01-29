# 🚀 Guia Rápido - Deploy em Rede Local

## Cenário: Usar em múltiplos dispositivos na mesma rede

### 📍 Passo 1: Preparar o Servidor (Máquina Principal)

Esta máquina vai rodar o backend + frontend

```bash
# 1. Descobrir o IP da máquina
# Windows:
ipconfig
# Linux/Mac:
ifconfig

# Exemplo de resultado: 192.168.1.100
```

### 📍 Passo 2: Configurar Backend

```bash
cd backend

# Criar arquivo .env
cp .env.example .env

# Editar .env:
# PORT=3333
# HOST=0.0.0.0  ← IMPORTANTE!
# JWT_SECRET=seu_secret_aqui

# Instalar e rodar
npm install
npm run dev
```

### 📍 Passo 3: Configurar Frontend

```bash
cd frontend

# Criar arquivo .env
cp .env.example .env

# Editar .env com o IP da máquina:
# VITE_API_URL=http://192.168.1.100:3333
#                    ^^^^^^^^^^^^^^^ seu IP aqui

# Instalar e rodar
npm install
npm run dev
```

### 📍 Passo 4: Liberar Firewall (Windows)

```powershell
# Execute no PowerShell como Administrador
netsh advfirewall firewall add rule name="ETGAGUA Backend" dir=in action=allow protocol=TCP localport=3333
netsh advfirewall firewall add rule name="ETGAGUA Frontend" dir=in action=allow protocol=TCP localport=5173
```

### 📍 Passo 5: Acessar de Outros Dispositivos

Na mesma rede Wi-Fi, abra no navegador:

```
http://192.168.1.100:5173
        ^^^^^^^^^^^^^^ IP da máquina servidor
```

---

## ✅ Checklist

- [ ] Backend rodando em 0.0.0.0:3333
- [ ] Frontend configurado com IP correto no .env
- [ ] Firewall liberado para portas 3333 e 5173
- [ ] Todos dispositivos na mesma rede Wi-Fi
- [ ] IP da máquina servidor anotado

---

## 🔧 Configurações Específicas

### Para Produção (Server Fixo)

Se quiser deixar rodando 24/7:

```bash
# Backend
cd backend
npm install -g pm2
pm2 start server.js --name etgagua-backend
pm2 save
pm2 startup

# Frontend (build estático)
cd frontend
npm run build
# Servir a pasta dist/ com nginx ou similar
```

### Para Desenvolvimento (Team)

Cada desenvolvedor:

1. Clona o repo
2. Configura `.env` apontando pro IP do servidor de DEV
3. Roda apenas `npm run dev` no frontend

Um único servidor roda o backend para todos.

---

## 🆘 Problemas Comuns

**"Não consigo acessar de outro celular"**
- Confirme que estão na mesma rede
- Verifique o firewall
- Teste ping: `ping 192.168.1.100`

**"Network Error no login"**
- Backend está rodando?
- IP correto no frontend/.env?
- CORS está ativado no backend? (já está)

**"Token inválido"**
- Limpe localStorage do navegador
- Faça login novamente

---

💡 **Dica**: Use um IP fixo (reservado no roteador) para a máquina servidor, assim não precisa reconfigurar quando o IP mudar!
