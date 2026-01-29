# 📤 Como Subir para o GitHub

## Pré-requisitos

- Git instalado
- Conta no GitHub
- Repositório criado no GitHub (pode ser público ou privado)

## 🎯 Passo a Passo

### 1. Inicializar Git no Projeto

```bash
cd etgagua-project
git init
```

### 2. Adicionar Arquivos

```bash
# Adicionar todos os arquivos (exceto os do .gitignore)
git add .

# Verificar o que será commitado
git status
```

### 3. Fazer o Primeiro Commit

```bash
git commit -m "Initial commit: Sistema ETGÁGUA completo"
```

### 4. Criar Repositório no GitHub

1. Acesse https://github.com
2. Clique em **"New repository"**
3. Nome: `etgagua-system` (ou outro de sua escolha)
4. Descrição: `Sistema de delivery de água com React + Node.js`
5. **NÃO** marque "Initialize with README" (já temos um)
6. Clique em **"Create repository"**

### 5. Conectar ao Repositório Remoto

```bash
# Substitua SEU_USUARIO pelo seu username do GitHub
git remote add origin https://github.com/SEU_USUARIO/etgagua-system.git

# Ou use SSH (se configurado):
# git remote add origin git@github.com:SEU_USUARIO/etgagua-system.git
```

### 6. Enviar para o GitHub

```bash
# Enviar para a branch main
git branch -M main
git push -u origin main
```

## ✅ Pronto!

Seu código está no GitHub! Acesse:
```
https://github.com/SEU_USUARIO/etgagua-system
```

---

## 🔄 Atualizações Futuras

### Fazer alterações e enviar

```bash
# 1. Ver arquivos modificados
git status

# 2. Adicionar arquivos específicos
git add backend/server.js frontend/src/pages/Login.jsx

# Ou adicionar tudo
git add .

# 3. Commitar com mensagem descritiva
git commit -m "feat: adicionar validação de telefone no cadastro"

# 4. Enviar para o GitHub
git push
```

### Boas práticas de commit

```bash
# Feature nova
git commit -m "feat: adicionar relatório de vendas por entregador"

# Correção de bug
git commit -m "fix: corrigir cálculo de troco em pedidos Pix"

# Melhoria
git commit -m "refactor: otimizar consulta SQL de produtos"

# Documentação
git commit -m "docs: atualizar README com instruções de deploy"
```

---

## 🔐 Segurança

### ⚠️ NUNCA commite:

- ❌ Arquivos `.env` (já está no `.gitignore`)
- ❌ `node_modules/` (já está no `.gitignore`)
- ❌ Banco de dados `*.sqlite` com dados reais (já está no `.gitignore`)
- ❌ Senhas ou tokens no código

### ✅ Sempre commite:

- ✅ `.env.example` (sem valores reais)
- ✅ Código fonte
- ✅ Documentação
- ✅ Configurações do projeto

---

## 👥 Trabalho em Equipe

### Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/etgagua-system.git
cd etgagua-system
./setup.sh
```

### Atualizar código local

```bash
git pull
```

### Criar branch para feature

```bash
# Criar e mudar para nova branch
git checkout -b feature/nome-da-feature

# Fazer alterações...
git add .
git commit -m "feat: minha nova feature"

# Enviar branch para o GitHub
git push -u origin feature/nome-da-feature
```

Depois crie um **Pull Request** no GitHub!

---

## 🆘 Problemas Comuns

### "Permission denied"

Use SSH ou configure credenciais:
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

### "Already exists"

Você já tem um repositório aqui:
```bash
rm -rf .git
git init
# ... continue do passo 1
```

### Esqueci de adicionar algo no .gitignore

```bash
# Remover arquivo do Git (mantém no disco)
git rm --cached arquivo.env

# Adicionar ao .gitignore
echo "arquivo.env" >> .gitignore

# Commitar
git add .gitignore
git commit -m "chore: adicionar arquivo.env ao gitignore"
git push
```

---

🎉 **Sucesso!** Seu projeto está versionado e seguro no GitHub!
