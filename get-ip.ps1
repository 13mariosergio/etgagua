Write-Host "🔍 Descobrindo IP da máquina..." -ForegroundColor Cyan
Write-Host ""

$IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    ($_.IPAddress -like '192.168.*') -or ($_.IPAddress -like '10.*') -or ($_.IPAddress -like '172.*')
} | Select-Object -First 1).IPAddress

if ($IP) {
    Write-Host "💻 Sistema: Windows" -ForegroundColor Green
    Write-Host "📡 IP da rede local: $IP" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📝 Configure o frontend/.env com:" -ForegroundColor Cyan
    Write-Host "   VITE_API_URL=http://${IP}:3333" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 Acesse de outros dispositivos em:" -ForegroundColor Cyan
    Write-Host "   http://${IP}:5173" -ForegroundColor White
    Write-Host ""
    Write-Host "🔥 Liberar Firewall (execute como Administrador):" -ForegroundColor Cyan
    Write-Host "   netsh advfirewall firewall add rule name='ETGAGUA Backend' dir=in action=allow protocol=TCP localport=3333" -ForegroundColor Gray
    Write-Host "   netsh advfirewall firewall add rule name='ETGAGUA Frontend' dir=in action=allow protocol=TCP localport=5173" -ForegroundColor Gray
} else {
    Write-Host "❌ Não foi possível detectar o IP automaticamente" -ForegroundColor Red
    Write-Host "Execute manualmente: ipconfig" -ForegroundColor Yellow
}

Write-Host ""
