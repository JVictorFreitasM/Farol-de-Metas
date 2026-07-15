# 📖 Guia: Como Usar as OSs com Claude

## 🚀 Fluxo de Trabalho

### Passo 1: Preparar o Repositório
```bash
# Clone o repositório local
git clone seu_repo
cd farol

# Configure git com suas credenciais
git config user.email "seu_email@empresa.com"
git config user.name "Seu Nome"

# Crie uma branch de desenvolvimento
git checkout -b dev/implementacao-os
```

### Passo 2: Ler a OS
Abra o arquivo `OS_IMPLEMENTACAO_FAROL.md` e leia a OS que vai implementar. Ex: **OS-001**.

**Seções importantes:**
- **Objetivo**: O que fazer
- **Contexto**: Por que fazer
- **Arquivos Afetados**: Quais arquivos modificar
- **O que Fazer**: Passos específicos (SEM código pronto)
- **Teste de Validação**: Como saber se funcionou
- **Commits Esperados**: Qual commit fazer

### Passo 3: Integrar com Claude (IDE)

#### Opção A: Claude Desktop App (Recomendado)
```
1. Abra Claude Code (abas na lateral)
2. Adicione sua pasta do projeto: File → Add Folder → /caminho/para/farol
3. Abra a OS no seu editor de texto
4. Copie o texto da OS (seções "Objetivo" até "Teste de Validação")
5. Cola no Claude e pede para implementar
6. Claude terá acesso aos arquivos da pasta para:
   - Ler código existente
   - Modificar arquivos
   - Executar comandos git
```

**Prompt Exemplo:**
```
Implemente a seguinte OS:

[COLA AQUI O TEXTO DA OS-001]

Notas:
- Não inclua explicações longas, foco em código
- Faça commit ao finalizar com a mensagem indicada
- Valide com os testes específicos
```

#### Opção B: Claude Web Chat + Copiar/Colar
```
1. Abra Claude na web (claude.ai)
2. Compartilhe o projeto uploadando arquivo ZIP (ou pasta)
3. Cole a OS
4. Claude analisa o código
5. Você copia o código gerado para seu IDE
6. Faz commit manualmente com mensagem da OS
```

#### Opção C: Fluxo Manual
```
1. Leia a OS
2. Implemente você mesmo baseado nas instruções
3. Faça commit com mensagem da OS
4. Passe para próxima OS
```

### Passo 4: Após Implementar

```bash
# Verificar que tudo foi commitado
git status
# Deve estar clean

# Ver histórico de commits
git log --oneline | head -10
# Deve ter: OS-XXX: descrição

# Fazer push (se quiser compartilhar antes de finalizar)
git push origin dev/implementacao-os
```

### Passo 5: Próxima OS
Repita Passo 2-4 com a próxima OS do cronograma.

---

## 📋 Checklist por OS

### OS-001: Remover Rate Limit por IP
- [ ] Ler OS-001
- [ ] Abrir `src/app.ts`
- [ ] Pedir ao Claude para implementar (ou fazer manualmente)
- [ ] Testar globalmente se rate limit funciona
- [ ] Commit: `chore: remover rate limit por IP para rede corporativa`
- [ ] Push

### OS-002: Implementar Histórico GET
- [ ] Ler OS-002
- [ ] Abrir `src/routes/metas.routes.ts`
- [ ] Pedir ao Claude para adicionar endpoint `/historico`
- [ ] Testar: `curl http://localhost:3000/metas/{uuid}/historico`
- [ ] Commit: `feat: adicionar endpoint de histórico de versões`
- [ ] Push

### OS-003: Consolidação Geral + Filtro Mês
- [ ] Ler OS-003
- [ ] Abrir arquivos frontend relacionados
- [ ] Pedir ao Claude para implementar
- [ ] Testar: Ver consolidação e bolinha verde/vermelha
- [ ] Commit: `feat: adicionar filtro de mês e consolidação geral no dashboard`
- [ ] Push

### OS-004: Ranking de Setores
- [ ] Ler OS-004
- [ ] Pedir ao Claude para implementar
- [ ] Testar: Ver metas pendentes ao expandir
- [ ] Commit: `feat: adicionar ranking de setores com metas pendentes expandíveis`
- [ ] Push

### OS-005: Gerente Preencher Metas
- [ ] Ler OS-005
- [ ] Abrir `src/routes/metas.routes.ts` (linha 457)
- [ ] Pedir ao Claude para adicionar "gerente" ao authorize
- [ ] Testar: Login como gerente e editar real
- [ ] Commit: `fix: permitir que gerente edite valores reais de metas`
- [ ] Push

### OS-006: Filtro Período de Meses
- [ ] Ler OS-006
- [ ] Pedir ao Claude para implementar
- [ ] Testar: Selecionar período e ver acúmulo
- [ ] Commit: `feat: adicionar filtro de período na tela de metas com acúmulo por período`
- [ ] Push

### OS-007: Reposicionar Dropdowns
- [ ] Ler OS-007
- [ ] Abrir `frontend/src/components/Topbar.tsx`
- [ ] Pedir ao Claude para mover para lado direito
- [ ] Testar: Ver dropdowns à direita
- [ ] Commit: `style: reposicionar dropdowns de ano e setor para lado direito`
- [ ] Push

### OS-008: Fixar Seleção de Setor
- [ ] Ler OS-008
- [ ] Abrir `frontend/src/hooks/useFilters.ts`
- [ ] Pedir ao Claude para implementar localStorage
- [ ] Testar: Selecionar setor, navegar, voltar (setor deve estar fixo)
- [ ] Commit: `feat: fixar seleção de setor em sessão do usuário`
- [ ] Push

### OS-009: Renomear Produtos para Cadastro
- [ ] Ler OS-009 (COMPLEXA, 2h)
- [ ] Preparar mental: vai mexer em vários arquivos
- [ ] Pedir ao Claude para implementar
- [ ] Testar: Navegar para Cadastro, ver 2 tabs
- [ ] Commit: `refactor: renomear Produtos para Cadastro e integrar indicadores`
- [ ] Push

### OS-010: Cores no Gráfico Comparativo
- [ ] Ler OS-010
- [ ] Abrir `frontend/src/components/RelatorioComparativa.tsx`
- [ ] Pedir ao Claude para implementar cores
- [ ] Testar: Ver cores no gráfico (verde, amarelo, laranja, vermelho)
- [ ] Commit: `feat: adicionar cores ao gráfico comparativo baseado em atingimento`
- [ ] Push

### OS-011: Histórico por Período
- [ ] Ler OS-011 (Rápida, 20 min)
- [ ] Abrir `src/routes/metas.routes.ts`
- [ ] Pedir ao Claude para adicionar endpoint
- [ ] Testar: `GET /metas/{uuid}/historico-periodo?ano=2026`
- [ ] Commit: `feat: adicionar endpoint de histórico por período`
- [ ] Push

---

## 🎙️ Prompts Recomendados para Claude

### Implementar uma OS (Formato Padrão)
```
Implemente a seguinte Ordem de Serviço (OS):

[COLA AQUI TEXTO COMPLETO DA OS]

Importante:
1. Não inclua código comentado ou explicações longas
2. Implemente direto o necessário
3. Siga os "Arquivos Afetados" indicados
4. Ao finalizar, faça commit com: git commit -m "Mensagem do Commits Esperados"
5. Não fazer git push (eu farei depois de revisar)
6. Validar conforme "Teste de Validação"

Comece!
```

### Se Tiver Dúvida em Uma OS
```
Estou em dúvida na OS-XXX no passo "X". Pode me ajudar?

[DESCREVA A DÚVIDA]

Contexto do projeto:
[COLE INFORMAÇÕES RELEVANTES]
```

### Fazer Push após Revisar
```
Revisei a implementação. Está tudo OK. Pode fazer:

git push origin dev/implementacao-os

Depois iniciamos a próxima OS.
```

### Reverter uma OS (se der ruim)
```
Houve um problema na implementação da OS-XXX. Vamos reverter:

git reset --hard HEAD~1

E depois refazer com ajustes.
```

---

## 🔍 Monitoramento de Progresso

### Visualizar Commits Realizados
```bash
git log --oneline | grep -i "OS\|feat\|fix\|refactor"
```

### Ver Mudanças de uma OS
```bash
# Se você sabe qual branch/commit
git show <commit_hash>

# Ver diff com main
git diff main dev/implementacao-os
```

### Testar Localmente Antes de Fazer Merge
```bash
# Testar branch atual
npm run dev  # Backend
cd frontend && npm run dev  # Frontend

# Quando tiver certeza
git checkout main
git merge dev/implementacao-os
git push origin main
```

---

## ⚠️ Pontos de Atenção

### 1. Ordem das OSs Importa
Algumas OSs dependem de outras:
- **OS-003** → Precisa estar pronta antes de **OS-004**
- Seguir cronograma sugerido na OS_IMPLEMENTACAO_FAROL.md

### 2. Testes Devem Passar
Cada OS tem "Teste de Validação". **NÃO avançar sem testar**.

### 3. Commits Claros
Use exatamente a mensagem sugerida em "Commits Esperados". Facilita rastrear e reverter.

### 4. Se Estiver Travado
```
1. Faça um commit "WIP: OS-XXX" para salvar
2. Chame Claude para debugar/ajudar
3. Se impossível, faça git reset --hard HEAD~1 e recomeça
```

### 5. Sincronizar com Main
Se outra pessoa mexer em main enquanto você trabalha:
```bash
git fetch origin
git rebase origin/main dev/implementacao-os
# ou
git merge origin/main dev/implementacao-os
```

---

## 📊 Estimativa de Tempo por OS

| OS | Tempo | Dificuldade | Prioridade |
|----|-------|-----------|-----------|
| OS-001 | 15 min | ⭐ Fácil | 🔴 Crítica |
| OS-002 | 20 min | ⭐ Fácil | 🟡 Média |
| OS-003 | 1h 30min | ⭐⭐ Média | 🔴 Crítica |
| OS-004 | 1h 30min | ⭐⭐ Média | 🔴 Crítica |
| OS-005 | 30 min | ⭐ Fácil | 🟡 Média |
| OS-006 | 1h 20min | ⭐⭐ Média | 🟡 Média |
| OS-007 | 20 min | ⭐ Fácil | 🟢 Baixa |
| OS-008 | 30 min | ⭐ Fácil | 🟡 Média |
| OS-009 | 2h | ⭐⭐⭐ Difícil | 🔴 Crítica |
| OS-010 | 1h | ⭐⭐ Média | 🟡 Média |
| OS-011 | 20 min | ⭐ Fácil | 🟢 Baixa |

**Total**: ~10 horas

---

## 🎯 Checklist Final

Ao terminar TODAS as OSs:

- [ ] Todos os commits foram feitos
- [ ] Todos os testes passaram
- [ ] Código foi revisado
- [ ] Push foi feito para `dev/implementacao-os`
- [ ] Criar Pull Request para `main`
- [ ] Revisar PR (você mesmo ou colega)
- [ ] Mergear para `main`
- [ ] Deletar branch `dev/implementacao-os`
- [ ] Fazer deploy em staging/produção
- [ ] Comunicar conclusão ao time

---

## 📞 Suporte

Se tiver dúvidas:
1. Releia a OS específica
2. Veja o "Contexto" e "O que Fazer"
3. Chame Claude: "Tenho dúvida na OS-XXX passo Y..."
4. Mostre erro específico se houver

---

**Última Atualização**: 16/07/2026
**Versão**: 1.0
