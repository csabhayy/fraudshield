# 📁 fraudshield - Project Structure

*Generated on: 10/08/2026, 00:42:29*

## 📋 Quick Overview

| Metric | Value |
|--------|-------|
| 📄 Total Files | 69 |
| 📁 Total Folders | 17 |
| 🌳 Max Depth | 3 levels |
| 🛠️ Tech Stack | React, TypeScript, CSS, Tailwind CSS, Node.js |

## ⭐ Important Files

- 🟡 🚫 **.gitignore** - Git ignore rules
- 🔴 📖 **README.md** - Project documentation
- 🟡 🐳 **docker-compose.yml** - Docker compose
- 🟡 🚫 **.gitignore** - Git ignore rules
- 🔴 📖 **README.md** - Project documentation
- 🟡 🔒 **package-lock.json** - Dependency lock
- 🔴 📦 **package.json** - Package configuration
- 🟡 🎨 **tailwind.config.js** - Tailwind config
- 🟡 🔷 **tsconfig.json** - TypeScript config
- 🟡 🔒 **package-lock.json** - Dependency lock
- 🔴 📦 **package.json** - Package configuration

## 📊 File Statistics

### By File Type

- 📄 **.py** (Other files): 16 files (23.2%)
- ⚛️ **.tsx** (React TypeScript files): 13 files (18.8%)
- 🔷 **.ts** (TypeScript files): 9 files (13.0%)
- ⚙️ **.json** (JSON files): 8 files (11.6%)
- 🎨 **.svg** (SVG images): 4 files (5.8%)
- 📄 **.csv** (Other files): 3 files (4.3%)
- 🚫 **.gitignore** (Git ignore): 2 files (2.9%)
- 📖 **.md** (Markdown files): 2 files (2.9%)
- 🎨 **.css** (Stylesheets): 2 files (2.9%)
- 🐳 **.dockerignore** (Docker ignore): 1 files (1.4%)
- 📄 **.api** (Other files): 1 files (1.4%)
- 📄 **.frontend** (Other files): 1 files (1.4%)
- 📄 **.db** (Other files): 1 files (1.4%)
- ⚙️ **.yml** (YAML files): 1 files (1.4%)
- 🌐 **.html** (HTML files): 1 files (1.4%)
- 📄 **.conf** (Other files): 1 files (1.4%)
- 🖼️ **.png** (PNG images): 1 files (1.4%)
- 📜 **.js** (JavaScript files): 1 files (1.4%)
- 📄 **.txt** (Text files): 1 files (1.4%)

### By Category

- **Other**: 23 files (33.3%)
- **React**: 13 files (18.8%)
- **Config**: 9 files (13.0%)
- **TypeScript**: 9 files (13.0%)
- **Assets**: 5 files (7.2%)
- **DevOps**: 3 files (4.3%)
- **Docs**: 3 files (4.3%)
- **Styles**: 2 files (2.9%)
- **Web**: 1 files (1.4%)
- **JavaScript**: 1 files (1.4%)

### 📁 Largest Directories

- **root**: 69 files
- **frontend**: 40 files
- **frontend/src**: 26 files
- **frontend/src/components**: 9 files
- **services**: 8 files

## 🌳 Directory Structure

```
fraudshield/
├── 🐳 .dockerignore
├── 🟡 🚫 **.gitignore**
├── 📂 agents/
│   ├── 📄 __init__.py
│   ├── 📄 nodes.py
│   ├── 📄 supervisor.py
│   └── 📄 workflow.py
├── 📂 data/
│   ├── 📄 customers.csv
│   ├── 📄 fraudshield.db
│   ├── 📄 merchants.csv
│   └── 📄 transactions.csv
├── 🟡 🐳 **docker-compose.yml**
├── 📄 Dockerfile.api
├── 📄 Dockerfile.frontend
├── 📂 frontend/
│   ├── 🟡 🚫 **.gitignore**
│   ├── ⚙️ .oxlintrc.json
│   ├── 🌐 index.html
│   ├── 📄 nginx.conf
│   ├── 🟡 🔒 **package-lock.json**
│   ├── 🔴 📦 **package.json**
│   ├── 🌐 public/
│   │   ├── 🎨 favicon.svg
│   │   └── 🎨 icons.svg
│   ├── 🔴 📖 **README.md**
│   ├── 📁 src/
│   │   ├── 🔌 api/
│   │   │   └── 🔷 client.ts
│   │   ├── 🎨 App.css
│   │   ├── ⚛️ App.tsx
│   │   ├── 📦 assets/
│   │   │   ├── 🖼️ hero.png
│   │   │   ├── 🎨 react.svg
│   │   │   └── 🎨 vite.svg
│   │   ├── 🧩 components/
│   │   │   ├── ⚛️ DashboardFooter.tsx
│   │   │   ├── ⚛️ DashboardHeader.tsx
│   │   │   ├── ⚛️ InvestigationModal.tsx
│   │   │   ├── ⚛️ OngoingInvestigation.tsx
│   │   │   ├── ⚛️ RecentActivity.tsx
│   │   │   ├── ⚛️ RecentTransactions.tsx
│   │   │   ├── ⚛️ TransactionActivityChart.tsx
│   │   │   ├── ⚛️ UnusualTransactionAlerts.tsx
│   │   │   └── ⚛️ VerificationPanel.tsx
│   │   ├── 📂 data/
│   │   │   └── 🔷 mockData.ts
│   │   ├── 🎣 hooks/
│   │   │   ├── 🔷 useChat.ts
│   │   │   ├── 🔷 useDashboardStats.ts
│   │   │   └── 🔷 useInvestigation.ts
│   │   ├── 🎨 index.css
│   │   ├── ⚛️ main.tsx
│   │   ├── 📄 pages/
│   │   │   ├── ⚛️ Dashboard.tsx
│   │   │   └── ⚛️ InvestigationPage.tsx
│   │   ├── 📂 stores/
│   │   │   └── 🔷 investigationStore.ts
│   │   ├── 📂 types/
│   │   │   └── 🔷 dashboard.ts
│   │   └── 🔧 utils/
│   │   │   └── 🔷 format.ts
│   ├── 🟡 🎨 **tailwind.config.js**
│   ├── ⚙️ tsconfig.app.json
│   ├── 🟡 🔷 **tsconfig.json**
│   ├── ⚙️ tsconfig.node.json
│   └── 🔷 vite.config.ts
├── 📄 main.py
├── 📂 models/
│   ├── 📄 __init__.py
│   └── 📄 schemas.py
├── 🟡 🔒 **package-lock.json**
├── 🔴 📦 **package.json**
├── 🔴 📖 **README.md**
├── 📄 requirements.txt
├── 📂 services/
│   ├── 📄 __init__.py
│   ├── 📄 agent_tools.py
│   ├── 📄 anomaly_detector.py
│   ├── 📄 data_service.py
│   ├── 📄 graph_service.py
│   ├── 📄 rule_engine.py
│   ├── 📄 transaction_generator.py
│   └── 📄 vector_service.py
└── 🧪 tests/
│   └── 📄 test_agent.py
```

## 📖 Legend

### File Types
- 🐳 DevOps: Docker ignore
- 🚫 DevOps: Git ignore
- 📄 Other: Other files
- 📖 Docs: Markdown files
- ⚙️ Config: YAML files
- ⚙️ Config: JSON files
- 🌐 Web: HTML files
- 🎨 Assets: SVG images
- 🎨 Styles: Stylesheets
- ⚛️ React: React TypeScript files
- 🔷 TypeScript: TypeScript files
- 🖼️ Assets: PNG images
- 📜 JavaScript: JavaScript files
- 📄 Docs: Text files

### Importance Levels
- 🔴 Critical: Essential project files
- 🟡 High: Important configuration files
- 🔵 Medium: Helpful but not essential files
