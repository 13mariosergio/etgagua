# 🚰 ETGÁGUA - Sistema de Delivery de Água

Sistema completo para gestão de delivery de água com interface web responsiva e backend robusto.

## 📋 Características

- ✅ **Gestão de Pedidos**: Criação, acompanhamento e atualização de status
- ✅ **Sistema de Usuários**: ADMIN, ATENDENTE e ENTREGADOR com permissões diferenciadas
- ✅ **Produtos e Preços**: Cadastro de produtos com controle de estoque
- ✅ **Relatórios Financeiros**: KPIs, vendas por produto, fechamento de caixa
- ✅ **Interface Responsiva**: Mobile-first design com navegação otimizada
- ✅ **Autenticação JWT**: Segurança com tokens
- ✅ **Multi-usuário**: Funciona em rede local com múltiplos dispositivos

## 🏗️ Arquitetura

```
etgagua-project/
├── backend/          # Node.js + Express + SQLite
│   ├── server.js
│   ├── auth.js
│   ├── db.js
│   ├── relatorios.js
│   └── package.json
└── frontend/         # React + Vite
    ├── src/
    │   ├── pages/
    │   ├── components/
    │   ├── auth/
    │   └── api.js
    └── package.json
```

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn

### 1. Clonar o repositório

```bash
git clone <seu-repositorio>
cd etgagua-project
```

### 2. Configurar Backend

```bash
cd backend

# Instalar dependências
npm install

# Criar arquivo .env (copiar do .env.example)
cp .env.example .env

# Editar .env com suas configurações
# Para aceitar conexões de outros dispositivos na rede, use HOST=0.0.0.0
```

**Arquivo `.env` do backend:**
```env
PORT=3333
HOST=0.0.0.0
JWT_SECRET=seu_secret_super_secreto_aqui
NODE_ENV=development
```

### 3. Configurar Frontend

```bash
cd ../frontend

# Instalar dependências
npm install

# Criar arquivo .env
cp .env.example .env
```

**Arquivo `.env` do frontend:**

Para **desenvolvimento local** (mesmo computador):
```env
VITE_API_URL=http://localhost:3333
```

Para **outros dispositivos na mesma rede**:
```env
VITE_API_URL=http://192.168.1.100:3333
```
> ⚠️ Substitua `192.168.1.100` pelo **IP real da máquina** que está rodando o backend

## 🖥️ Como Rodar

### Backend (Terminal 1)

```bash
cd backend
npm run dev
```

O backend estará rodando em `http://0.0.0.0:3333`

### Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

## 📱 Acessando de Outros Dispositivos

### 1. Descobrir o IP da máquina do backend

**Windows:**
```bash
ipconfig
```
Procure por "IPv4" (ex: 192.168.1.100)

**Linux/Mac:**
```bash
ifconfig
# ou
ip addr show
```

### 2. Configurar o Frontend

Edite o arquivo `frontend/.env`:
```env
VITE_API_URL=http://192.168.1.100:3333
```

### 3. Acessar de Outros Dispositivos

- **Backend**: `http://IP_DA_MAQUINA:3333`
- **Frontend**: `http://IP_DA_MAQUINA:5173`

> **Importante**: Todos os dispositivos precisam estar na **mesma rede Wi-Fi/LAN**

### 4. Liberar Firewall (se necessário)

**Windows:**
```powershell
netsh advfirewall firewall add rule name="ETGAGUA Backend" dir=in action=allow protocol=TCP localport=3333
netsh advfirewall firewall add rule name="ETGAGUA Frontend" dir=in action=allow protocol=TCP localport=5173
```

**Linux:**
```bash
sudo ufw allow 3333/tcp
sudo ufw allow 5173/tcp
```

## 👥 Credenciais Padrão

```
Usuário: admin
Senha: admin123
```

> ⚠️ **IMPORTANTE**: Altere a senha padrão após o primeiro login!

## 🔐 Perfis de Usuário

### ADMIN
- Acesso total ao sistema
- Cadastro de usuários e produtos
- Visualização de relatórios
- Gestão de pedidos

### ATENDENTE
- Criação de pedidos
- Atualização de status (ABERTO → EM_ROTA)
- Visualização de pedidos

### ENTREGADOR
- Visualização de pedidos
- Atualização de status (EM_ROTA → ENTREGUE/CANCELADO)

## 📊 Funcionalidades Principais

### Gestão de Pedidos
- Criação com itens, quantidades e valores
- Cálculo automático de troco (pagamento em dinheiro)
- Formas de pagamento: Dinheiro, Pix, Cartão
- Status: ABERTO → EM_ROTA → ENTREGUE/CANCELADO

### Relatórios (ADMIN)
- Total vendido no período
- Ticket médio
- Vendas por status
- Vendas por forma de pagamento
- Top produtos vendidos
- Fechamento de caixa

## 🛠️ Tecnologias

### Backend
- Node.js + Express
- SQLite (banco de dados local)
- JWT para autenticação
- bcrypt para hash de senhas

### Frontend
- React 19
- Vite (build tool)
- React Router (navegação)
- Axios (requisições HTTP)
- CSS puro (sem frameworks)

## 📦 Build para Produção

### Backend
```bash
cd backend
npm start
```

### Frontend
```bash
cd frontend
npm run build
```

Os arquivos de produção estarão em `frontend/dist/`

## 🐛 Troubleshooting

### Erro "Network Error" no frontend

1. Verifique se o backend está rodando
2. Confirme o IP no arquivo `.env` do frontend
3. Verifique o firewall da máquina
4. Certifique-se que os dispositivos estão na mesma rede

### Erro "EADDRINUSE" no backend

A porta 3333 já está em uso. Opções:
- Mude a porta no `.env`: `PORT=3334`
- Ou mate o processo: `lsof -ti:3333 | xargs kill -9` (Linux/Mac)

### Banco de dados não inicia

Delete o arquivo `backend/etgagua.sqlite` e reinicie o servidor. Um novo banco será criado automaticamente.

## 📄 Licença

ISC

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

Desenvolvido com ❤️ para facilitar o delivery de água
