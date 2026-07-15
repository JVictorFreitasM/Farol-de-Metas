# 🎯 Ordens de Serviço - Sistema Farol


```

---

## OS-001: Remover Rate Limit por IP (Rede Corporativa)

**Prioridade**: 🔴 CRÍTICA
**Tempo Estimado**: 15 min
**Severidade do Problema**: Bloqueio em massa em rede corporativa com proxy

### Objetivo
Remover rate limiting por IP que causa bloqueio em massa em ambientes corporativos. Substituir por rate limit global (servidor) sem chave por IP.

### Contexto
Sistema atual usa `express-rate-limit` com chave por IP, mas em rede corporativa vários usuários compartilham o mesmo IP (proxy). Isso causa bloqueio de todos os usuários quando um atinge o limite.

### Arquivos Afetados
- `src/app.ts` (linhas 30-38)

### O que Fazer

1. **Analisar** a configuração atual de rate limit em `src/app.ts`
2. **Modificar** rate limit para:
   - Remover `keyGenerator` baseado em IP
   - Aumentar limite global para 500 req/min
   - Manter apenas para servidores (não por usuário)
3. **Validar** que:
   - Rate limit ainda funciona globalmente
   - Não está bloqueando por IP individual
   - Documentar que em produção considerar implementar cache Redis para distribuir

### Teste de Validação
```bash
# Fazer 600 requisições em 1 minuto (globais) - deve bloquear após 500
# Se fizer de IPs diferentes mesmo na corporativa, não deve bloquear
```

### Commits Esperados
```
chore: remover rate limit por IP para rede corporativa
```

---

## OS-002: Implementar Histórico de Versões em GET

**Prioridade**: 🟡 MÉDIA
**Tempo Estimado**: 20 min
**Severity**: Usuários não conseguem ver histórico

### Objetivo
Criar novo endpoint que retorna histórico completo de alterações de uma meta (versões anteriores com valores antes/depois).

### Contexto
Sistema já registra histórico em `MetaHistorico` mas não há endpoint para consultar. Usuários precisam ver quem alterou o quê e quando.

### Arquivos Afetados
- `src/routes/metas.routes.ts` (adicionar novo endpoint GET /:id/historico)
- Não afeta frontend inicialmente (futuro)

### O que Fazer

1. **Criar** novo endpoint: `GET /metas/:id/historico`
2. **Retornar** estrutura com:
   - metaId
   - indicador da meta
   - array de versões com: versao, alteradoEm, alteradoPor (nome), motivo, valoresAntes, valoresDepois
   - ordenado por mais recente primeiro
3. **Validar** que:
   - Usuário tem acesso ao setor (mesmo que admin)
   - Meta existe
   - Retorna JSON estruturado

### Teste de Validação
```bash
GET /metas/{uuid}/historico
# Deve retornar histórico completo com todas as versões
```

### Commits Esperados
```
feat: adicionar endpoint de histórico de versões
```

---

## OS-003: Consolidação Geral do Dashboard com Filtro de Mês

**Prioridade**: 🔴 CRÍTICA
**Tempo Estimado**: 1h 30min
**Dependências**: Nenhuma

### Objetivo
Adicionar filtro de mês no dashboard com nova coluna "Consolidação Geral" que mostra % de preenchimento de metas por setor com indicador visual (bolinha verde/vermelha).

### Contexto
Gerentes precisam saber rapidamente quais setores ainda têm metas não preenchidas no mês atual/selecionado. Nova coluna deve aparecer entre nome do setor e percentual de atingimento.

### Arquivos Afetados
- `frontend/src/components/DashboardCards.tsx` (ou arquivo principal dashboard)
- `frontend/src/hooks/useFilters.ts` (adicionar filtro de mês)
- `frontend/src/services/metasService.ts` (se precisar novo query param)
- Possivelmente novo hook: `useConsolidacaoGeral.ts`

### O que Fazer

1. **Frontend**:
   - Adicionar filtro de seleção de mês (dropdown com Jan-Dez) ao lado do filtro de Ano
   - Criar coluna "Consolidação Geral" entre "Setor" e "Atingimento (%)"
   - Coluna deve mostrar:
     - Percentual de preenchimento: (metas com real preenchido / total de metas) * 100
     - Bolinha verde se 100% preenchido
     - Bolinha vermelha se < 100%
   - Aplicar filtro de mês para:
     - Considerar apenas metas do mês selecionado
     - Mostrar status do mês específico, não acumulado

2. **Backend** (se necessário):
   - Verificar se `GET /metas` retorna informações necessárias
   - Possivelmente adicionar query param: `mes=jan` para filtrar apenas metas com real/meta do mês

3. **Validar** que:
   - Consolidação calcula corretamente
   - Bolinha muda cor baseado no preenchimento
   - Filtro de mês afeta corretamente o cálculo
   - Funciona com dados do setor do usuário

### Teste de Validação
```
1. Acessar Dashboard
2. Filtrar por mês diferente de dezembro
3. Ver consolidação geral aparecer corretamente
4. Ver bolinha verde (100%) ou vermelha (<100%)
```

### Commits Esperados
```
feat: adicionar filtro de mês e consolidação geral no dashboard
```

---

## OS-004: Ranking de Setores com Metas Pendentes

**Prioridade**: 🔴 CRÍTICA
**Tempo Estimado**: 1h 30min
**Dependências**: OS-003 (usa consolidação geral)

### Objetivo
Expandir seção "Ranking de Setores" para mostrar metas não preenchidas no mês selecionado. Ao clicar no card do setor, expandir mostrando lista de metas pendentes. Adicionar filtro por mês.

### Contexto
Gerentes precisam visualizar rapidamente quais setores têm metas pendentes de preenchimento e quais são essas metas. Facilita acompanhamento mensal.

### Arquivos Afetados
- `frontend/src/components/DashboardCards.tsx` (seção Ranking)
- `frontend/src/hooks/useFilters.ts` (compartilhar filtro de mês)
- Possivelmente novo componente: `MetasPendentesExpandido.tsx`

### O que Fazer

1. **Card do Setor no Ranking**:
   - Mostrar bolinha verde/vermelha (consolidação - do OS-003)
   - Ao lado: mostrar quantas metas estão pendentes (ex: "5 pendentes")
   - Ao clicar no card, expandir mostrando:
     - Lista de indicadores que não têm real preenchido para o mês selecionado
     - Mostrar indicador, tipo (IC/IV), responsável
     - Link/botão para editar diretamente

2. **Filtro de Mês**:
   - Compartilhar com o filtro do OS-003
   - Ao mudar mês, atualizar lista de pendentes

3. **Validar** que:
   - Expandir/recolher funciona
   - Lista de pendentes é correta para o mês selecionado
   - Clique em indicador pendente leva para edição
   - Bolinha verde/vermelha funciona

### Teste de Validação
```
1. Dashboard → Seção Ranking
2. Ver bolinha vermelha + "N pendentes"
3. Clicar no card para expandir
4. Ver lista de metas não preenchidas
5. Mudar filtro de mês e ver lista atualizar
```

### Commits Esperados
```
feat: adicionar ranking de setores com metas pendentes expandíveis
```

---

## OS-005: Garantir que Gerente Consiga Preencher Metas

**Prioridade**: 🟡 MÉDIA
**Tempo Estimado**: 30 min
**Severidade**: Bloqueio funcional se gerente não conseguir preencher

### Objetivo
Garantir que gerentes tenham permissão para preencher/editar metas (real mensal) além de apenas criar/editar as definições de meta.

### Contexto
Atualmente apenas `responsavel` pode usar `PUT /metas/:id/real`. Gerentes precisam dessa permissão também para preencher metas quando responsável não está disponível.

### Arquivos Afetados
- `src/routes/metas.routes.ts` (linha 457, endpoint PUT /metas/:id/real)

### O que Fazer

1. **Backend**:
   - Verificar rota `PUT /metas/:id/real` atualmente usa `authorize("responsavel")`
   - Modificar para `authorize("responsavel", "gerente", "admin")`
   - Garantir validação de setor (gerente só edita seu setor)

2. **Frontend**:
   - Verificar se tabela de metas permite edição para gerentes
   - Se não permitir, habilitar

3. **Validar** que:
   - Gerente consegue editar real de metas de seu setor
   - Gerente NÃO consegue editar real de metas de outro setor
   - Admin consegue editar real de qualquer setor
   - Responsável continua funcionando normalmente

### Teste de Validação
```
1. Login como gerente
2. Acessar tela de Metas
3. Tentar editar campo de real mensal
4. Deve salvar com sucesso
```

### Commits Esperados
```
fix: permitir que gerente edite valores reais de metas
```

---

## OS-006: Filtro de Período de Meses na Tela de Metas

**Prioridade**: 🟡 MÉDIA
**Tempo Estimado**: 1h 20min
**Dependências**: Nenhuma

### Objetivo
Adicionar filtro de período de meses na tela de Metas para visualizar acúmulo real/meta de um período específico (ex: Jan-Jun). Mostrar acúmulo do período no card do indicador.

### Contexto
Usuários precisam analisar desempenho em períodos específicos (semestral, trimestral) além do acumulado anual. Endpoint `/metas/:id/acumulado-periodo` já existe no backend.

### Arquivos Afetados
- `frontend/src/components/MetasTable.tsx` (ou Dashboard de metas)
- `frontend/src/services/metasService.ts` (chamar endpoint acumulado-periodo)
- Possivelmente novo hook: `usePeriodoFiltro.ts`

### O que Fazer

1. **Frontend**:
   - Adicionar seletor de período (date range picker ou dropdowns mes_inicio/mes_fim)
   - Ao selecionar período:
     - Chamar `GET /metas/:id/acumulado-periodo?mes_inicio=jan&mes_fim=jun`
     - Mostrar resultado em um card/seção ao lado esquerdo dos valores mensais
     - Mostrar: Acúmulo Meta (período), Acúmulo Real (período), Status Acúmulo (período)
   - Quando nenhum período selecionado, mostrar acumulado anual (comportamento atual)

2. **Validar** que:
   - Período selecionado filtra corretamente
   - Acúmulo do período calcula corretamente
   - UI não fica poluída (considerar cards/abas)
   - Funciona para diferentes tipos de período

### Teste de Validação
```
1. Tela de Metas
2. Selecionar período: Janeiro-Junho
3. Ver acúmulo do período (real/meta) aparecer
4. Mudar período, valores devem atualizar
```

### Commits Esperados
```
feat: adicionar filtro de período na tela de metas com acúmulo por período
```

---

## OS-007: Reposicionar Dropdowns de Ano e Setor para Lado Direito

**Prioridade**: 🟢 BAIXA
**Tempo Estimado**: 20 min
**Impacto**: UX/Layout

### Objetivo
Mover dropdowns de Ano e Setor para o lado direito do header (ao invés de embaixo) para melhor aproveitar espaço horizontal.

### Contexto
Layout melhor, mais espaço para título/conteúdo. Padrão comum em dashboards.

### Arquivos Afetados
- `frontend/src/components/Topbar.tsx` (ou componente que tem os filtros)
- `frontend/src/App.css` (ou arquivo de estilos)

### O que Fazer

1. **Reorganizar layout**:
   - Mover dropdowns para lado direito (flexbox justify-content: space-between)
   - Manter título/logo à esquerda
   - Dropdowns à direita

2. **Validar** que:
   - Layout fica equilibrado
   - Responsive funciona em mobile
   - Não quebra em telas pequenas

### Teste de Validação
```
1. Abrir aplicação
2. Ver Ano e Setor no lado direito
3. Testar responsividade
```

### Commits Esperados
```
style: reposicionar dropdowns de ano e setor para lado direito
```

---

## OS-008: Fixar Seleção de Setor (como Ano)

**Prioridade**: 🟡 MÉDIA
**Tempo Estimado**: 30 min
**Dependências**: Nenhuma

### Objetivo
Ao clicar/selecionar um setor, manter ele fixado até o usuário trocar manualmente (similar ao comportamento do filtro de Ano).

### Contexto
Atualmente setor é resetado ao navegar. Usuário quer que fique fixado por sessão (localStorage).

### Arquivos Afetados
- `frontend/src/hooks/useFilters.ts` (ou hook que gerencia filtros)
- `frontend/src/App.tsx` (se usar context global)

### O que Fazer

1. **Armazenar seleção de setor**:
   - Salvar em localStorage quando usuário seleciona setor
   - Recuperar ao carregar a página
   - Se usuário for responsável, usar seu setorId padrão
   - Se admin, usar último selecionado

2. **Validar** que:
   - Setor fica fixado ao navegar
   - Pode resetar manualmente
   - Admin consegue trocar entre setores
   - Responsável fica fixado no seu setor

### Teste de Validação
```
1. Selecionar setor X
2. Navegar para outra página
3. Voltar e ver setor X selecionado
4. Trocar para setor Y
5. Verificar que fixou no Y
```

### Commits Esperados
```
feat: fixar seleção de setor em sessão do usuário
```

---

## OS-009: Renomear "Produtos" para "Cadastro" e Integrar Indicadores

**Prioridade**: 🔴 CRÍTICA
**Tempo Estimado**: 2h
**Dependências**: Nenhuma
**Complexidade**: ALTA - Mudança estrutural

### Objetivo
Renomear aba "Produtos" para "Cadastro" e integrar cadastro de indicadores (ICs e IVs) nela. Remover formulário de criação de indicadores da tela de Metas.

### Contexto
Usuário quer centralizar todo cadastro (produtos E indicadores) em um único lugar. Atualmente:
- Produtos: `frontend/src/pages/ProdutosPage.tsx`
- Indicadores: Criados via modal em `MetasPage.tsx`

Novo fluxo:
- Uma única aba "Cadastro" com tabs/seções para Produtos e Indicadores

### Arquivos Afetados
- `frontend/src/pages/ProdutosPage.tsx` → renomear para `CadastroPage.tsx`
- `frontend/src/components/ProdutosTable.tsx` → manter
- `frontend/src/components/CriarMetaModal.tsx` → remover de MetasPage.tsx, integrar em CadastroPage
- `frontend/src/pages/MetasPage.tsx` (remover seção de criar indicador)
- `frontend/src/components/AppLayout.tsx` ou componente de navegação (trocar label "Produtos" para "Cadastro")
- `frontend/src/App.tsx` (atualizar rota)

### O que Fazer

1. **Reorganizar estrutura**:
   - Renomear arquivo e componente de Produtos para Cadastro
   - Criar layout com 2 tabs/seções na página:
     - Tab 1: Produtos (manter conteúdo atual)
     - Tab 2: Indicadores (mover CriarMetaModal daqui, criar tabela de indicadores)

2. **Tab de Indicadores**:
   - Exibir lista de ICs (Indicadores de Contexto)
   - Botão para criar novo IC
   - Ao selecionar IC, mostrar seus IVs (filhos)
   - Botão para criar novo IV sob o IC selecionado
   - Opção de editar/deletar indicadores

3. **Tab de Produtos**:
   - Manter funcionalidade atual (criar, editar, ativar/desativar)

4. **Remover de MetasPage**:
   - Remover CriarMetaModal ou deixar apenas para edição de valores (não criação)
   - Adicionar link/botão que leva para Cadastro > Indicadores

5. **Atualizar navegação**:
   - Sidebar/Menu: "Produtos" → "Cadastro"
   - Rota: `/produtos` → `/cadastro`

6. **Validar** que:
   - Consegue criar ICs
   - Consegue criar IVs sob um IC
   - Consegue editar indicadores
   - Consegue deletar indicadores
   - Produtos continuam funcionando
   - MetasPage não permite criar indicadores (apenas editar reais)

### Teste de Validação
```
1. Acessar menu → Cadastro (antes era Produtos)
2. Ver 2 tabs: Produtos e Indicadores
3. Tab Indicadores → Criar novo IC
4. Selecionar IC → Criar novo IV
5. MetasPage → Não deve ter botão de "Criar Indicador"
```

### Commits Esperados
```
refactor: renomear Produtos para Cadastro e integrar indicadores
```

---

## OS-010: Relatório Comparativo com Cores por Atingimento

**Prioridade**: 🟡 MÉDIA
**Tempo Estimado**: 1h
**Dependências**: Nenhuma

### Objetivo
No relatório de Comparativa (gráficos), colorir barras/linha do gráfico baseado no percentual de atingimento:
- Verde: > 75%
- Amarelo: 50-74%
- Laranja: 25-49%
- Vermelho: < 25%

### Contexto
Visualização rápida do status de cada indicador no gráfico. Cores padronizadas facilitam interpretação.

### Arquivos Afetados
- `frontend/src/components/RelatorioComparativa.tsx` (ou componente de gráfico)
- `frontend/src/components/DashboardCharts.tsx` (se reutilizar lógica)

### O que Fazer

1. **Adicionar função de cor**:
   - Criar função que retorna cor baseado em percentual de atingimento
   - Cores: verde (#4CAF50), amarelo (#FFC107), laranja (#FF9800), vermelho (#F44336)

2. **Aplicar às séries do gráfico**:
   - Para cada ponto/barra de série, calcular percentual
   - Aplicar cor correspondente
   - Se usar ECharts: usar `itemStyle` com cor dinâmica
   - Se usar Recharts: usar `fill` dinâmico

3. **Adicionar legenda**:
   - Mostrar referência de cores no gráfico
   - Legenda: Verde (>75%), Amarelo (50-74%), Laranja (25-49%), Vermelho (<25%)

4. **Validar** que:
   - Cores aparecem corretamente
   - Legenda é clara
   - Responsivo em diferentes tamanhos
   - PDF export mantém cores

### Teste de Validação
```
1. Relatórios > Comparativa
2. Ver gráfico com cores baseado em atingimento
3. Clicar em legenda, cores devem fazer sentido
4. Export PDF deve manter cores
```

### Commits Esperados
```
feat: adicionar cores ao gráfico comparativo baseado em atingimento
```

---

## OS-011: Histórico de Metas por Período (Backend)

**Prioridade**: 🟢 BAIXA
**Tempo Estimado**: 20 min
**Dependências**: Nenhuma
**Nota**: Complemento ao OS-002 (histórico)

### Objetivo
Criar endpoint que retorna histórico de metas de um determinado período (ano), mostrando valores de cada mês e como evoluíram.

### Contexto
Complementa análise de desempenho ao longo do tempo. Útil para comparações históricas.

### Arquivos Afetados
- `src/routes/metas.routes.ts` (adicionar novo endpoint)

### O que Fazer

1. **Criar endpoint**: `GET /metas/:id/historico-periodo?ano=2026`
   - Retornar todas as metas daquele ID no ano especificado
   - Se houver múltiplas versões no mesmo ano, retornar todas
   - Estrutura: ano, versoes com (mes_meta, mes_real, status_mes, data_alteracao)

2. **Validar** que:
   - Retorna dados corretos
   - Ordena cronologicamente
   - Suporta diferentes anos

### Teste de Validação
```bash
GET /metas/{uuid}/historico-periodo?ano=2026
```

### Commits Esperados
```
feat: adicionar endpoint de histórico por período
```

---

## Cronograma Recomendado

### Dia 1 - Morning (2h)
- [ ] OS-001: Remover rate limit (15 min)
- [ ] OS-002: Implementar histórico GET (20 min)
- [ ] OS-007: Reposicionar dropdowns (20 min)

### Dia 1 - Afternoon (3h)
- [ ] OS-005: Gerente preencher metas (30 min)
- [ ] OS-008: Fixar seleção de setor (30 min)
- [ ] OS-003: Consolidação geral + filtro mês (1h 30min)

### Dia 2 - Morning (3h)
- [ ] OS-004: Ranking de setores com pendentes (1h 30min)
- [ ] OS-006: Filtro período de meses (1h 20min)

### Dia 2 - Afternoon (2h)
- [ ] OS-010: Cores no gráfico comparativo (1h)
- [ ] OS-011: Histórico por período (20 min)

### Dia 3 - Full (2h)
- [ ] OS-009: Renomear Produtos para Cadastro (2h)

**Total**: ~10h de desenvolvimento

---

## Notas Importantes

### Commits
Após cada OS completada, fazer commit:
```bash
git add .
git commit -m "Implementado OS-XXX: descrição breve"
git push
```

### Testes
Cada OS tem "Teste de Validação" específico. Executar antes de considerar concluída.

### Dependências
Algumas OSs dependem de outras (ex: OS-004 usa consolidação do OS-003). Seguir cronograma.

### Backend vs Frontend
- OS que mexem em rotas/lógica: Backend
- OS que mexem em UI/componentes: Frontend
- OS que mexem em ambos: Indicado em "Arquivos Afetados"

### Rollback
Se algo der errado, sempre tem histórico de commits. Use `git revert` conforme necessário.

---

**Última Atualização**: 16/07/2026
**Total de OSs**: 11
**Tempo Total**: ~10h
