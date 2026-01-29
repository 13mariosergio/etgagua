#!/bin/bash

echo "🚰 ETGÁGUA - Setup Inicial"
echo "=========================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Backend
echo -e "${YELLOW}📦 Instalando dependências do backend...${NC}"
cd backend
npm install
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Criando arquivo .env do backend...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Edite backend/.env e configure o HOST=0.0.0.0${NC}"
fi
cd ..

# 2. Frontend
echo ""
echo -e "${YELLOW}📦 Instalando dependências do frontend...${NC}"
cd frontend
npm install
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Criando arquivo .env do frontend...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Edite frontend/.env e configure o IP do backend${NC}"
fi
cd ..

# 3. Descobrir IP
echo ""
echo -e "${YELLOW}🔍 Descobrindo seu IP...${NC}"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    IP=$(hostname -I | awk '{print $1}')
elif [[ "$OSTYPE" == "darwin"* ]]; then
    IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
else
    IP="<SEU_IP_AQUI>"
fi

echo ""
echo -e "${GREEN}✅ Setup concluído!${NC}"
echo ""
echo "📝 Próximos passos:"
echo ""
echo "1. Configure o backend/.env:"
echo "   HOST=0.0.0.0"
echo "   PORT=3333"
echo ""
echo "2. Configure o frontend/.env:"
echo "   VITE_API_URL=http://$IP:3333"
echo ""
echo "3. Inicie o sistema:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo ""
echo "4. Acesse:"
echo "   Local: http://localhost:5173"
echo "   Rede: http://$IP:5173"
echo ""
echo "🔐 Login padrão: admin / admin123"
echo ""
