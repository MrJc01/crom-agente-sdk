# Guia de Publicação do SDK no NPM (Versão Alpha)

Este guia descreve como publicar novas versões do SDK em TypeScript (`crom-agente-sdk`) no NPM, tanto manualmente quanto através da pipeline automática do GitHub Actions.

---

## 1. Publicação Manual via Terminal

Se você tem as credenciais de publicação da organização no NPM e deseja publicar diretamente de sua máquina local:

### Passo A: Atualizar a Versão no `package.json`
Edite o arquivo `typescript/package.json` e mude o campo `"version"` para a versão alfa desejada:
```json
"version": "0.1.0-alpha.1"
```

### Passo B: Compilar o SDK
Entre na pasta `typescript/` e gere a build estática de distribuição:
```bash
cd typescript
npm install
npm run build
```
*(Isso gerará os arquivos de bundle final na pasta `dist/`)*

### Passo C: Fazer login no NPM
Se for a primeira vez publicando nesta sessão:
```bash
npm login
```

### Passo D: Publicar sob a tag `alpha`
Para versões de desenvolvimento e pré-lançamento (como `-alpha`, `-beta`), **é altamente recomendado** publicar utilizando a flag `--tag alpha`. 

Isso impede que o NPM trate a versão alfa como a versão estável padrão (`latest`), evitando que usuários comuns a instalem por engano ao rodar `npm install crom-agente-sdk`.

```bash
npm publish --access public --tag alpha
```

---

## 2. Publicação Automática via GitHub Actions

O repositório está configurado com o workflow `.github/workflows/npm-publish.yml` que escuta eventos de **Releases Publicadas** no GitHub.

### Passo A: Subir as Alterações de Versão
1. Atualize a versão no `typescript/package.json` (Ex: `"0.1.0-alpha.1"`).
2. Commit e Push na branch principal:
   ```bash
   git add typescript/package.json
   git commit -m "bump: version to 0.1.0-alpha.1"
   git push origin master
   ```

### Passo B: Criar a Tag e Release no GitHub
1. Crie a tag correspondente e envie para o GitHub:
   ```bash
   git tag v0.1.0-alpha.1
   git push origin v0.1.0-alpha.1
   ```
2. Acesse a página do repositório no GitHub e clique em **Create a new release** (Criar novo lançamento).
3. Selecione a tag `v0.1.0-alpha.1`.
4. Marque a opção **"Set as a pre-release"** (Definir como pré-lançamento) e clique em **Publish release**.
5. O GitHub Actions iniciará o processo e fará a publicação no NPM automaticamente.

---

## 3. Como os Usuários Instalam a Versão Alpha?

Uma vez publicada sob a tag `alpha`, os desenvolvedores podem instalar especificando o canal:

```bash
npm install crom-agente-sdk@alpha
```

Para ver as tags ativas publicadas e garantir que a tag `alpha` foi registrada corretamente, execute:
```bash
npm info crom-agente-sdk dist-tags
```
