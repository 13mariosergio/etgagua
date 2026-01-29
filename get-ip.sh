#!/bin/bash

echo "🔍 Descobrindo IP da máquina..."
echo ""

# Detectar sistema operacional
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    IP=$(hostname -I | awk '{print $1}')
    echo "💻 Sistema: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac
    IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    echo "💻 Sistema: macOS"
else
    echo "💻 Sistema: Windows (use 'ipconfig' manualmente)"
    echo ""
    echo "No PowerShell, execute:"
    echo "  Get-NetIPAddress -AddressFamily IPv4 | Where-Object {(\$_.IPAddress -like '192.168.*') -or (\$_.IPAddress -like '10.*')}"
    exit 0
fi

echo "📡 IP da rede local: $IP"
echo ""
echo "📝 Configure o frontend/.env com:"
echo "   VITE_API_URL=http://$IP:3333"
echo ""
echo "🌐 Acesse de outros dispositivos em:"
echo "   http://$IP:5173"
echo ""
