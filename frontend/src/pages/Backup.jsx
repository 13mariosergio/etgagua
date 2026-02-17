import { useState } from 'react';
import { api } from '../api';
import './Backup.css';

export default function BackupDeDados() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importMode, setImportMode] = useState('append'); // append ou replace
  const [message, setMessage] = useState(null);

  // EXPORTAR BACKUP
  async function exportarBackup() {
    setExporting(true);
    setMessage(null);

    try {
      const response = await api.get('/admin/backup/export', {
        responseType: 'blob'
      });

      // Criar link de download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const filename = `etgagua-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage({
        type: 'success',
        text: `✅ Backup baixado com sucesso! (${filename})`
      });

    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      setMessage({
        type: 'error',
        text: `❌ Erro ao exportar backup: ${error.response?.data?.error || error.message}`
      });
    } finally {
      setExporting(false);
    }
  }

  // IMPORTAR BACKUP
  async function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Validar formato
      if (!backup.data || !backup.metadata) {
        throw new Error('Arquivo de backup inválido');
      }

      // Confirmar importação
      const stats = backup.stats || {};
      const confirmMsg = importMode === 'replace' 
        ? `⚠️ ATENÇÃO: Isso vai SUBSTITUIR todos os dados atuais!\n\nBackup contém:\n- ${stats.totalClientes || 0} clientes\n- ${stats.totalProdutos || 0} produtos\n- ${stats.totalUsuarios || 0} usuários\n\nTem certeza?`
        : `Importar dados do backup?\n\nBackup contém:\n- ${stats.totalClientes || 0} clientes\n- ${stats.totalProdutos || 0} produtos\n- ${stats.totalUsuarios || 0} usuários\n\n(Dados duplicados serão ignorados)`;

      if (!confirm(confirmMsg)) {
        setImporting(false);
        return;
      }

      // Enviar para o backend
      const response = await api.post('/admin/backup/import', {
        backup,
        mode: importMode
      });

      const { importados } = response.data;

      setMessage({
        type: 'success',
        text: `✅ Backup importado com sucesso!\n\n` +
              `📊 Importados:\n` +
              `- ${importados.clientes} clientes\n` +
              `- ${importados.produtos} produtos\n` +
              `- ${importados.usuarios || 0} usuários`
      });

      // Limpar input
      event.target.value = '';

    } catch (error) {
      console.error('Erro ao importar backup:', error);
      setMessage({
        type: 'error',
        text: `❌ Erro ao importar backup: ${error.response?.data?.error || error.message}`
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="backup-page">
      <div className="backup-header">
        <h1>📦 Backup de Dados</h1>
        <p>Exporte e importe seus dados de forma segura</p>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div className={`backup-message ${message.type}`}>
          <pre>{message.text}</pre>
          <button onClick={() => setMessage(null)} className="btn-close">✕</button>
        </div>
      )}

      {/* EXPORTAR */}
      <div className="backup-section">
        <div className="backup-card export-card">
          <div className="card-icon">📥</div>
          <h2>Exportar Backup</h2>
          <p>Baixe todos os dados do sistema em formato JSON</p>
          
          <div className="backup-info">
            <strong>O backup inclui:</strong>
            <ul>
              <li>✅ Todos os clientes cadastrados</li>
              <li>✅ Todos os produtos</li>
              <li>✅ Últimos 1000 pedidos</li>
              <li>✅ Lista de usuários (sem senhas)</li>
            </ul>
          </div>

          <button 
            onClick={exportarBackup} 
            disabled={exporting}
            className="btn btn-primary btn-large"
          >
            {exporting ? '⏳ Exportando...' : '📥 Baixar Backup Completo'}
          </button>
        </div>
      </div>

      {/* IMPORTAR */}
      <div className="backup-section">
        <div className="backup-card import-card">
          <div className="card-icon">📤</div>
          <h2>Importar Backup</h2>
          <p>Restaure dados de um backup anterior</p>

          {/* Modo de importação */}
          <div className="import-mode">
            <label className="mode-label">
              <strong>Modo de importação:</strong>
            </label>
            
            <div className="radio-group">
              <label className="radio-option">
                <input 
                  type="radio" 
                  name="mode" 
                  value="append"
                  checked={importMode === 'append'}
                  onChange={(e) => setImportMode(e.target.value)}
                />
                <div>
                  <strong>➕ Adicionar</strong>
                  <small>Mantém dados atuais e adiciona novos (recomendado)</small>
                </div>
              </label>

              <label className="radio-option">
                <input 
                  type="radio" 
                  name="mode" 
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={(e) => setImportMode(e.target.value)}
                />
                <div>
                  <strong>⚠️ Substituir</strong>
                  <small>Remove dados atuais e importa do backup</small>
                </div>
              </label>
            </div>
          </div>

          {/* Input de arquivo */}
          <div className="file-upload">
            <input 
              type="file" 
              id="backup-file"
              accept=".json"
              onChange={importarBackup}
              disabled={importing}
              style={{ display: 'none' }}
            />
            <label htmlFor="backup-file" className={`btn btn-secondary btn-large ${importing ? 'disabled' : ''}`}>
              {importing ? '⏳ Importando...' : '📤 Selecionar Arquivo de Backup'}
            </label>
            <small className="file-hint">Apenas arquivos .json</small>
          </div>
        </div>
      </div>
      

      {/* Dicas */}
      <div className="backup-tips">
        <h3>💡 Dicas Importantes</h3>
        <ul>
          <li><strong>Faça backups regularmente</strong> - Recomendamos fazer backup semanalmente</li>
          <li><strong>Guarde em local seguro</strong> - Armazene os arquivos em múltiplos locais (nuvem, HD externo)</li>
          <li><strong>Teste a restauração</strong> - Periodicamente, teste se o backup pode ser restaurado</li>
          <li><strong>Modo "Adicionar"</strong> - Use quando quiser mesclar dados de diferentes backups</li>
          <li><strong>Modo "Substituir"</strong> - Use apenas se quiser restaurar completamente um backup antigo</li>
        </ul>
      </div>
    </div>
  );
}
