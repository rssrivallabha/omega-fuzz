# Omega Fuzz

Omega Fuzz is a premium, source-level fuzzing platform engineered for security researchers, compiler engineers, and professional developers. 

It moves beyond blind, random mutation by employing deep Abstract Syntax Tree (AST) analysis to deterministically extract constraints, boundaries, and validation checkpoints directly from your source code.

## 🌟 Features

- **Multi-Target Orchestration**: Parses entire source files and automatically spawns isolated campaigns for every discovered callable target.
- **Intelligent Constraint Synthesis**: Evaluates AST `Compare` and `If` nodes to dynamically generate high-value boundary seeds (e.g., automatically generating `-1`, `0`, `1`, `99`, `100`, `101` for a `value < 100` constraint).
- **Explicit Validation Classification**: Distinguishes between intentional input rejection (e.g. explicit `raise ValueError("Invalid")`) and genuine, unexpected system crashes.
- **Zero-Friction UI**: A highly responsive, professional "Mission Control" interface that tells the story of your fuzzing campaign in real-time.
- **Forensic PDF Export**: Generates high-fidelity, highly detailed forensic reports of your campaign findings, complete with target context and deduplicated crash fingerprints.

## 🚀 How to Use

### 1. Local Development

Omega Fuzz is built as an npm monorepo containing both the orchestration engine and the React frontend.

```bash
# Install all dependencies across the monorepo
npm install

# Build the packages
npm run build

# Start the frontend and backend servers simultaneously
npm run dev --workspaces
```

Once running, navigate to `http://localhost:5173` in your browser.

### 2. Running a Campaign

1. **Input Source**: Paste your source code (e.g., Python scripts containing multiple functions) into the Mission Control code editor.
2. **Configure Limits**: Adjust the input volume slider to determine how deep the fuzzing campaign should run per target.
3. **Initialize Engine**: Click **Initialize Engine**. Omega Fuzz will parse the AST, extract targets, synthesize seeds, and begin streaming execution telemetry.

### 3. Understanding the Telemetry

As the campaign runs, the live dashboard visualizes the backend orchestrator's reasoning:
- **Live Feed**: Streams adaptive batches of `PASS` events, while expanding interesting discoveries like `UNEXPECTED_EXCEPTION` and `EXPECTED_REJECTION`.
- **Discovery Strategies**: The feed reveals exactly *how* a crash was found (e.g., `Boundary Mutation`, `Constraint Solver`, `Type Mutation`).
- **Telemetry Chart**: Tracks the aggregate execution rate across your targets.

Once the campaign concludes, click **Export Forensic PDF** to generate a permanent artifact of all discovered vulnerabilities.

## 🌐 Deploying to Vercel

Omega Fuzz is fully configured for zero-setup deployment to Vercel. 

1. Push your repository to GitHub.
2. Import the repository into your Vercel Dashboard.
3. **Leave all settings as default.** The included `vercel.json` and `/api` wrapper automatically orchestrate the build process and proxy backend traffic to Vercel Serverless Functions.

## 🛠 Supported Languages

The engine's modular adapter architecture currently includes implementations/stubs for:
- Python (Primary Support)
- JavaScript / TypeScript
- C++
- Go
- Swift
- SQL
